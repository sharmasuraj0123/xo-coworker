// storm.js after a failed first load and across resets, end to end on a fake backend: recovery, the pool gate, frames with no reducer, lookups read again.
import { fakeBackend, boot, until, settle, advance, fail, fire, thread, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();

t("a first load that failed is read again when the stream is back: threads appear with no new-thread lines", async () => {
  let down = true;
  const be = fakeBackend({
    "GET /chat/chats": () => (down ? fail(503, { code: "engine_not_running", message: "down" }) : { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] }),
    "GET /chat/chats/chat_p/threads": { threads: [thread("a"), thread("b")] },
  });
  const { world, events } = await boot(be);
  assert.equal(world.state.errorCode, "engine_not_running");
  assert.equal(world.state.threads.length, 0);
  down = false;
  be.end();
  await until(() => be.conns.length === 2);
  be.push("heartbeat", { data: {} });
  await until(() => world.state.threads.length === 2, 4000);
  assert.equal(world.state.error, null);
  await settle();
  assert.equal(events.filter((e) => e.kind === "spawn").length, 0, "what the recovery found isn't announced as new");
});

t("a pool never seen before, on the stream or in a status read, reads the runtimes again; a known pool's change doesn't", async () => {
  const be = fakeBackend({ "GET /chat/status": { pools: [{ id: "cc:a", state: "open" }] } });
  await boot(be);
  const n = be.count("GET", "/chat/runtimes");
  be.push("pool", { seq: 10, data: { pool: "cc:a", state: "warn" } }, 10);
  await settle();
  assert.equal(be.count("GET", "/chat/runtimes"), n);
  be.push("pool", { seq: 11, data: { pool: "cc:b", state: "open" } }, 11);
  await until(() => be.count("GET", "/chat/runtimes") === n + 1);
  await settle();
  be.routes["GET /chat/status"] = { pools: [{ id: "cc:a", state: "open" }, { id: "cc:b", state: "open" }, { id: "cc:c", state: "open" }] };
  fire("visibilitychange");
  await until(() => be.count("GET", "/chat/runtimes") >= n + 2, 2000);
});

t("a block frame re-renders without a reducer; a frame from a chat not known lists the chats again, at most every 30 s", async () => {
  const be = fakeBackend();
  const { world } = await boot(be);
  let renders = 0;
  world.subscribe(() => renders++);
  renders = 0;
  be.push("turn.started", { session_id: "s", chat_id: "chat_p", turn_id: "tu", seq: 20, data: {} }, 20);
  await settle();
  renders = 0;
  be.push("block.started", { session_id: "s", chat_id: "chat_p", turn_id: "tu", seq: 21, data: { block: { id: "b", type: "text", index: 0, text: "hi" } } }, 21);
  await settle();
  assert.ok(renders >= 1, "re-rendered");
  const chats = be.count("GET", "/chat/chats");
  be.push("message", { chat_id: "chat_new", seq: 22, data: { id: "m", chat_id: "chat_new", text: "x" } }, 22);
  await settle();
  assert.equal(be.count("GET", "/chat/chats"), chats, "the boot's listing is recent");
  advance(31000);
  be.push("message", { chat_id: "chat_new", seq: 23, data: { id: "m2", chat_id: "chat_new", text: "y" } }, 23);
  await until(() => be.count("GET", "/chat/chats") === chats + 1);
});

t("after a reset, rows looked up by id before are looked up again", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/messages": { messages: [] } });
  const { world } = await boot(be);
  const reads = () => be.count("GET", "/chat/chats/chat_p/messages");
  world.act.findRows("demo", ["x"], 100);
  await until(() => reads() === 1);
  world.act.findRows("demo", ["x"], 100);
  await settle();
  assert.equal(reads(), 1);
  be.push("reset", { data: { reason: "retention", from_seq: 5 } });
  be.end();
  await until(() => be.conns.length === 2);
  await settle();
  world.act.findRows("demo", ["x"], 100);
  await until(() => reads() === 2);
});

await done();
