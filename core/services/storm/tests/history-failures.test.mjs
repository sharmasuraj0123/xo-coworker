import assert from "node:assert/strict";
import { test } from "node:test";
import { advance, boot, fail, fakeBackend, settle, thread, until } from "../../../../tests/storm-harness.mjs";

const EVENT_PATH = "/chat/events";
const MESSAGE_PATH = "/chat/chats/chat_p/messages";
const newest = String(Number.MAX_SAFE_INTEGER);
const refusal = fail(500, { code: "history_failure", message: "Stored history failed." });
const row = (seq) => ({ id: `r${seq}`, seq, chat_id: "chat_p", thread_ts: "thread" });

for (const [label, kinds] of [["recent turns", false], ["thread controls", true]]) {
  test(`${label} report unexpected failures and tolerate an unavailable endpoint`, async (t) => {
    const reported = [];
    t.mock.method(console, "error", (error) => reported.push(error.code));
    const backend = fakeBackend({
      ["GET " + EVENT_PATH]: (query) => Boolean(query.kinds) === kinds ? refusal : { events: [] },
    });
    const { world } = await boot(backend);
    t.after(world.dispose);
    await world.act.loadTurns("session");
    assert.deepEqual(reported, ["history_failure"]);
    backend.routes["GET " + EVENT_PATH] = fail(404, "Not Found");
    await world.act.loadTurns("session");
    assert.deepEqual(reported, ["history_failure"], "expected missing history is silent");
  });
}

test("older stored turn failures report once and the older messages still land", async (t) => {
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error.code));
  const backend = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("thread", { session_id: "session" })] },
    "GET /chat/chats/chat_p/hops": { hops: [] },
    ["GET " + MESSAGE_PATH]: (query) => query.before_seq === newest
      ? { messages: [row(10)], next_before_seq: 10 } : { messages: [row(5)] },
    ["GET " + EVENT_PATH]: (query) => query.before_seq === newest ? { events: [], next_before_seq: 50 } : refusal,
  });
  const { world } = await boot(backend);
  t.after(world.dispose);
  world.act.watchThread("thread");
  await until(() => world.state.threadHist.thread?.loaded);
  await world.act.loadOlderThread("thread");
  assert.deepEqual(world.state.threadMsgs.thread.map(({ seq }) => seq), [5, 10]);
  assert.deepEqual(reported, ["history_failure"]);
});

test("lookup paging reports a failed read without publishing messages into the timeline", async (t) => {
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error.code));
  const backend = fakeBackend({ ["GET " + MESSAGE_PATH]: refusal });
  const { world } = await boot(backend);
  t.after(world.dispose);
  world.act.findRows("demo", ["missing"]);
  await until(() => backend.count("GET", MESSAGE_PATH) > 0);
  await settle();
  assert.equal(world.state.timeline.demo, undefined);
  assert.deepEqual(reported, ["history_failure"]);
});

test("a transient lookup failure backs off and allows the same quote to recover", async (t) => {
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error.code));
  const backend = fakeBackend({
    ["GET " + MESSAGE_PATH]: ({ before_seq }) => before_seq === "21"
      ? { messages: [row(10)], next_before_seq: 10 } : refusal,
  });
  const { world } = await boot(backend);
  t.after(world.dispose);
  const lookup = () => world.act.findRows("demo", ["r5"], 20);
  lookup();
  await until(() => backend.count("GET", MESSAGE_PATH) === 2);
  await settle();
  for (let i = 0; i < 4; i++) lookup();
  await settle();
  assert.equal(backend.count("GET", MESSAGE_PATH), 2, "repeated draws honor the backoff");
  assert.deepEqual(reported, ["history_failure"]);
  backend.routes["GET " + MESSAGE_PATH] = { messages: [row(5)] };
  advance(1200);
  lookup();
  await settle();
  assert.equal(world.state.found.demo.get("r5")?.seq, 5, "the original lookup key can retry after a later page fails");
  assert.equal(world.state.timeline.demo, undefined);
});
