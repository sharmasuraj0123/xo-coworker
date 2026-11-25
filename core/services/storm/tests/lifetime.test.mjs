import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorld } from "../../world/store.js";
import { client } from "../client.js";
import { boot, fail, fakeBackend, fire, listeners, settle, thread, until } from "../../../../tests/storm-harness.mjs";

const statusPath = "/chat/status";
const messagesPath = "/chat/chats/chat_p/messages";
const threadsPath = "/chat/chats/chat_p/threads";

test("disposing before the first frame stops the stream without starting boot reads", async () => {
  const backend = fakeBackend();
  const world = createWorld();
  const stream = backend.asked[0];
  assert.equal(stream.path, "/chat/stream");
  world.dispose();
  assert.equal(stream.signal.aborted, true);
  assert.deepEqual([...listeners.values()].flat(), []);
  await settle();
  assert.equal(world.state.loaded, false);
  assert.equal(backend.asked.length, 1);
});

test("disposal retires one world, including held reads, queued lookups and accepted-write publication", async (t) => {
  const status = Promise.withResolvers();
  const history = Promise.withResolvers();
  const write = Promise.withResolvers();
  const pendingTimers = new Map();
  for (const [set, clear] of [["setTimeout", "clearTimeout"], ["setInterval", "clearInterval"]]) {
    const schedule = globalThis[set], cancel = globalThis[clear];
    t.mock.method(globalThis, set, (fn, delay, ...args) => {
      const handle = schedule(() => {
        if (set === "setTimeout") pendingTimers.delete(handle);
        fn(...args);
      }, delay);
      pendingTimers.set(handle, delay);
      return handle;
    });
    t.mock.method(globalThis, clear, (handle) => { pendingTimers.delete(handle); cancel(handle); });
  }
  const backend = fakeBackend({
    ["GET " + threadsPath]: { threads: [thread("thread")] },
    ["GET " + statusPath]: { pools: [] },
    ["GET " + messagesPath]: () => history.promise,
    ["POST " + messagesPath]: () => write.promise,
  });
  const first = createWorld();
  const second = createWorld();
  t.after(() => {
    first.dispose();
    second.dispose();
    status.resolve({ pools: [] });
    history.resolve({ messages: [] });
    write.resolve({});
  });
  await until(() => backend.conns.length === 2);
  backend.push("snapshot", { data: { seq: 1 } });
  const [firstConn] = backend.conns;
  firstConn.queue.push('event: snapshot\ndata: {"data":{"seq":1}}\n\n');
  firstConn.wake();
  await until(() => first.state.loaded && second.state.loaded);
  await settle();

  backend.routes["GET " + statusPath] = () => status.promise;
  const beforeDispose = new Set([...pendingTimers].filter(([, delay]) => delay === 60000).map(([handle]) => handle));
  assert.equal(beforeDispose.size, 2, "each world owns a prune timer");
  const pendingStatus = first.act.status();
  const pendingHistory = first.act.loadTimeline("demo");
  const pendingWrite = first.act.reply("thread", "An accepted reply");
  first.act.findRows("demo", ["older"]);
  const readCount = backend.asked.filter(({ path }) => path === messagesPath).length;
  const watched = backend.asked.slice(-3);
  const priorNow = first.state.now;
  let published = 0;
  const unsubscribe = first.subscribe(() => { published++; });
  first.dispose();
  first.dispose();
  assert.equal([...beforeDispose].filter((handle) => pendingTimers.has(handle)).length, 1, "only the other world has a prune timer");
  assert.equal([...pendingTimers.values()].includes(0), false, "the pending lookup timer is removed");
  assert.equal(listeners.get("visibilitychange").length, 1);
  assert.equal(listeners.get("online").length, 1);
  assert.deepEqual(backend.asked.slice(0, 2).map(({ signal }) => signal.aborted), [true, false]);
  assert.deepEqual(watched.map(({ method, signal }) => [method, signal.aborted]), [["GET", true], ["GET", true], ["POST", false]]);

  backend.routes["GET " + statusPath] = { pools: [{ id: "live", state: "open" }] };
  fire("visibilitychange");
  fire("online");
  await until(() => second.state.pools.live);
  status.resolve({ pools: [{ id: "retired", state: "open" }] });
  history.resolve({ messages: [{ id: "retired-message", seq: 2 }] });
  write.resolve({ id: "accepted", seq: 3 });
  const [, , receipt] = await Promise.all([pendingStatus, pendingHistory, pendingWrite]);
  await settle();
  assert.equal(receipt.id, "accepted");
  assert.equal(backend.asked.filter(({ path }) => path === messagesPath).length, readCount, "no queued seek runs");
  assert.equal(first.state.pools.retired, undefined, "a transport that ignores abort still cannot publish");
  assert.equal(first.state.timeline.demo, undefined);
  assert.equal(first.state.threadMsgs.thread, undefined);
  assert.equal(first.state.now, priorNow);
  assert.equal(published, 1, "only the immediate subscription notification arrives");
  assert.equal(unsubscribe(), false, "disposal released the subscription");
  second.dispose();
  assert.deepEqual([...pendingTimers.values()], [], "both worlds released their timers");
});

test("run detail and transcript reads belong to the world and to the caller", async (t) => {
  const detail = Promise.withResolvers(), transcript = Promise.withResolvers();
  const path = "/chat/runs/a";
  const backend = fakeBackend({ ["GET " + path]: () => detail.promise, ["GET " + path + "/transcript"]: () => transcript.promise });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); detail.resolve({}); transcript.resolve({}); });
  const controller = new AbortController();
  const handled = new AbortController();
  const firstReads = backend.asked.length;
  const runs = [
    world.act.run("a"), world.act.transcript("a", null),
    world.act.run("a", { signal: controller.signal }), world.act.transcript("a", null, { signal: controller.signal }),
    world.act.run("a", { signal: handled.signal }), world.act.transcript("a", null, { signal: handled.signal }),
  ].map((promise) => promise.catch((error) => error));
  await until(() => backend.asked.length === firstReads + 6);
  const issued = backend.asked.slice(firstReads);
  assert.deepEqual(issued.map(({ signal }) => signal.aborted), Array(6).fill(false));
  handled.abort();
  assert.deepEqual(issued.map(({ signal }) => signal.aborted), [false, false, false, false, true, true]);
  world.dispose();
  assert.equal(controller.signal.aborted, false, "an independent caller is still live");
  assert.deepEqual(issued.map(({ signal }) => signal.aborted), Array(6).fill(true));
  await assert.rejects(world.act.run("a"), { name: "AbortError" });
  await assert.rejects(world.act.transcript("a", null), { name: "AbortError" });
  assert.equal(backend.asked.length, firstReads + 6, "retired reads never reach the transport");
  detail.resolve({});
  transcript.resolve({});
  assert.deepEqual((await Promise.all(runs)).map(({ name }) => name), Array(6).fill("AbortError"));
});

for (const retire of ["caller", "world"]) {
  test(`Runs rejects when the ${retire} aborts after the shared read settles`, async (t) => {
    const result = Promise.withResolvers();
    const backend = fakeBackend();
    const { world } = await boot(backend);
    t.after(world.dispose);
    t.mock.method(client, "runs", () => result.promise);
    const caller = new AbortController();
    const read = world.act.listRuns("session", { signal: caller.signal });
    result.resolve({ runs: [{ id: "retired", state: "running" }] });
    queueMicrotask(() => { if (retire === "caller") caller.abort(); else world.dispose(); });
    await assert.rejects(read, { name: "AbortError" });
    assert.equal(world.state.runs.has("retired"), false);
    assert.equal(caller.signal.aborted, retire === "caller", "the other signal is independent");
  });
}

for (const phase of ["boot", "recovery"]) {
  test(`disposal during ${phase} replay discards the remaining frames and publication`, async (t) => {
    const chats = Promise.withResolvers();
    const path = "/chat/chats";
    const recovery = phase === "recovery";
    const initial = recovery ? fail(503, { code: "engine_not_running", message: "down" }) : () => chats.promise;
    const backend = fakeBackend({ ["GET " + path]: initial });
    t.mock.method(console, "error", () => {});
    const world = createWorld();
    t.after(() => { world.dispose(); chats.resolve({ chats: [] }); });
    backend.push("snapshot", { data: { seq: 1 } });
    await until(() => backend.count("GET", path) === 1);
    if (recovery) {
      await until(() => world.state.loaded);
      backend.routes["GET " + path] = () => chats.promise;
      backend.end();
      await until(() => backend.conns.length === 2);
      backend.push("heartbeat", { data: {} });
      await until(() => backend.count("GET", path) === 2);
    }
    const router = world.state.router;
    let publishedAt;
    world.onEvent((event) => {
      if (event.kind !== "file") return;
      world.dispose();
      publishedAt = world.state.now;
    });
    backend.push("file.version", { seq: 2, data: { path: "a.txt" } });
    backend.push("settings", { seq: 3, data: { key: "router", value: { mode: "off" } } });
    await settle();
    assert.equal(publishedAt, undefined, "the frames are held");
    chats.resolve({ chats: [] });
    await until(() => publishedAt != null);
    await settle();
    assert.equal(world.state.router, router, "the second frame did not mutate the retired world");
    assert.equal(world.state.loaded, recovery, "boot did not publish loaded after disposal");
    assert.equal(world.state.now, publishedAt, "replay did not publish a final update");
  });
}

for (const older of [false, true]) {
  test(`disposing from a ${older ? "loadOlder" : "loadTimeline"} subscriber skips transport dispatch`, async (t) => {
    const backend = fakeBackend({ ["GET " + messagesPath]: { messages: [{ id: "m", seq: 10 }], next_before_seq: 10 } });
    const { world } = await boot(backend);
    t.after(world.dispose);
    if (older) await world.act.loadTimeline("demo");
    const reads = backend.count("GET", messagesPath);
    world.subscribe((state) => { if (state.hist.demo?.loading) world.dispose(); });
    await (older ? world.act.loadOlder("demo") : world.act.loadTimeline("demo"));
    assert.equal(backend.count("GET", messagesPath), reads, "already-aborted signal prevented fetch");
  });
}
