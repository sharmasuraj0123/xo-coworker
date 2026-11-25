import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorld } from "../../world/store.js";
import { boot, fail, fakeBackend, settle, thread, until } from "../../../../tests/storm-harness.mjs";

const chatPath = "/chat/chats";
const threadsPath = chatPath + "/chat_p/threads";
const messagesPath = chatPath + "/chat_p/messages";
const chats = { chats: [{ id: "chat_p", kind: "project", project: "demo" }] };

function held() {
  const gate = Promise.withResolvers();
  return { ...gate, read: () => gate.promise };
}

test("a recovery cutoff retires the loads before held frames are applied", async (t) => {
  const threads = held(), messages = held();
  const backend = fakeBackend({ ["GET " + chatPath]: fail(503, { code: "engine_not_running", message: "down" }) });
  t.mock.method(console, "error", () => {});
  const world = createWorld();
  t.after(() => { world.dispose(); threads.resolve({ threads: [] }); messages.resolve({ messages: [] }); });
  backend.push("snapshot", { data: { seq: 1 } });
  await until(() => world.state.loaded);
  const setTimeoutReal = globalThis.setTimeout;
  let cutoff;
  t.mock.method(globalThis, "setTimeout", (fn, delay, ...args) => {
    if (delay === 15000) { cutoff = () => fn(...args); return setTimeoutReal(() => {}, delay); }
    return setTimeoutReal(fn, delay, ...args);
  });

  backend.routes["GET " + chatPath] = chats;
  backend.routes["GET " + threadsPath] = threads.read;
  backend.end();
  await until(() => backend.conns.length === 2);
  backend.push("heartbeat", { data: {} });
  await until(() => cutoff && backend.count("GET", threadsPath) === 1);
  const request = backend.asked.find(({ path }) => path === threadsPath);
  backend.routes["GET " + messagesPath] = messages.read;
  world.act.watch(["demo"]);
  await until(() => backend.count("GET", messagesPath) === 1);
  const timelineRequest = backend.asked.find(({ path }) => path === messagesPath);
  backend.routes["GET " + messagesPath] = { messages: [{ id: "restarted", seq: 6 }] };
  backend.push("thread", { seq: 2, chat_id: "chat_p", data: thread("a", { title: "Live title" }) });
  await settle();
  assert.equal(world.thread("a"), undefined, "the stream is holding frames during recovery");
  cutoff();
  await until(() => world.thread("a")?.title === "Live title");
  assert.equal(request.signal.aborted, true, "cutoff cancels the losing request");
  assert.equal(timelineRequest.signal.aborted, true, "cutoff cancels the watched page");
  assert.equal(backend.count("GET", messagesPath), 2, "recovery restarts the watched read");
  messages.resolve({ messages: [{ id: "retired", seq: 3 }] });
  threads.resolve({ threads: [thread("a", { title: "Stale snapshot" }), thread("unseen")] });
  await settle();
  assert.equal(world.thread("a").title, "Live title");
  assert.equal(world.thread("unseen"), undefined, "no rows from the retired snapshot publish");
  assert.deepEqual(world.state.timeline.demo.map(({ id }) => id), ["restarted"], "the watched page resumes on the current cycle");
});

test("a reset reloads the watched timeline and discards its older in-flight page", async (t) => {
  const old = held();
  const backend = fakeBackend({ ["GET " + messagesPath]: old.read });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); old.resolve({ messages: [] }); });
  world.act.watch(["demo"]);
  await until(() => backend.count("GET", messagesPath) === 1);
  const request = backend.asked.find(({ path }) => path === messagesPath);
  backend.routes["GET " + messagesPath] = { messages: [{ id: "fresh", seq: 8 }] };
  backend.push("reset", { data: { reason: "retention", from_seq: 6 } });
  backend.end();
  await until(() => world.state.timeline.demo?.some(({ id }) => id === "fresh"));
  assert.equal(request.signal.aborted, true, "reset aborts the old page request");
  old.resolve({ messages: [{ id: "old", seq: 2 }] });
  await settle();
  assert.deepEqual(world.state.timeline.demo.map(({ id }) => id), ["fresh"]);
  assert.equal(world.state.hist.demo.loaded, true);
});

test("held list and detail reads cannot overwrite newer frames or delete new rows", async (t) => {
  const list = held(), detail = held();
  const detailPath = threadsPath + "/a";
  const backend = fakeBackend({ ["GET " + threadsPath]: { threads: [thread("a")] } });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); list.resolve({ threads: [] }); detail.resolve(thread("a")); });
  backend.routes["GET " + threadsPath] = list.read;
  backend.routes["GET " + detailPath] = detail.read;
  const oldList = world.act.refresh();
  const oldDetail = world.act.fetchThread("chat_p", "a");
  await until(() => backend.count("GET", threadsPath) === 2 && backend.count("GET", detailPath) === 1);

  backend.push("thread", { seq: 2, chat_id: "chat_p", data: thread("a", { title: "Live title" }) });
  backend.push("thread", { seq: 3, chat_id: "chat_p", data: thread("b", { title: "New thread" }) });
  await until(() => world.thread("b") && world.thread("a")?.title === "Live title");
  list.resolve({ threads: [thread("a", { title: "Old list" })] });
  await oldList;
  assert.equal(world.thread("a").title, "Live title");
  assert.equal(world.thread("b")?.title, "New thread", "an older list cannot delete a streamed thread");
  detail.resolve(thread("a", { title: "Old detail" }));
  await oldDetail;
  assert.equal(world.thread("a").title, "Live title");
});

test("an older listing cannot revive an omitted thread after a newer refresh", async (t) => {
  const first = held(), second = held();
  const backend = fakeBackend({ ["GET " + threadsPath]: { threads: [thread("a"), thread("b")] } });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); first.resolve({ threads: [] }); second.resolve({ threads: [] }); });
  backend.routes["GET " + threadsPath] = first.read;
  const older = world.act.refresh();
  await until(() => backend.count("GET", threadsPath) === 2);
  backend.routes["GET " + threadsPath] = second.read;
  const newer = world.act.refresh();
  await until(() => backend.count("GET", threadsPath) === 3);
  second.resolve({ threads: [thread("a", { title: "Latest" })] });
  await newer;
  first.resolve({ threads: [thread("a", { title: "Retired" }), thread("b"), thread("unseen")] });
  await older;
  assert.equal(world.thread("a").title, "Latest");
  assert.equal(world.thread("b"), undefined, "the newer listing's removal wins");
  assert.equal(world.thread("unseen"), undefined, "the superseded listing cannot add rows");
});

test("a card frame keeps its fields while a held detail hydrates the rest of the thread", async (t) => {
  const detail = held();
  const detailPath = threadsPath + "/a";
  const backend = fakeBackend({ ["GET " + threadsPath]: { threads: [thread("a", { title: null })] } });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); detail.resolve(thread("a")); });
  backend.routes["GET " + detailPath] = detail.read;
  const read = world.act.fetchThread("chat_p", "a");
  await until(() => backend.count("GET", detailPath) === 1);
  backend.push("card", { seq: 2, chat_id: "chat_p", data: { ts: "a", card: { title: "Live card" } } });
  await until(() => world.thread("a")?.card?.title === "Live card");
  detail.resolve(thread("a", { title: "Hydrated title", card: { title: "Old card" } }));
  await read;
  await until(() => world.thread("a")?.title === "Hydrated title");
  assert.equal(world.thread("a").card.title, "Live card");
});

test("a held detail cannot resurrect a thread after its deletion succeeds", async (t) => {
  const detail = held();
  const path = threadsPath + "/a";
  const backend = fakeBackend({
    ["GET " + threadsPath]: { threads: [thread("a")] },
    ["GET " + path]: detail.read,
    ["DELETE " + path]: { deleted: true },
  });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); detail.resolve(thread("a")); });
  const read = world.act.fetchThread("chat_p", "a");
  await until(() => backend.count("GET", path) === 1);
  await world.act.deleteThread("a");
  await until(() => !world.thread("a"));
  detail.resolve(thread("a", { title: "Old title" }));
  await read;
  await settle();
  assert.equal(world.thread("a"), undefined);
});

test("a held chat listing preserves a streamed creation, routing change and retirement", async (t) => {
  const listing = held();
  const before = { chats: [...chats.chats, { id: "chat_retired", kind: "project", project: "old" }] };
  const backend = fakeBackend({ ["GET " + chatPath]: before });
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); listing.resolve(before); });
  backend.routes["GET " + chatPath] = listing.read;
  const refresh = world.act.refresh();
  await until(() => backend.count("GET", chatPath) === 2);
  backend.push("chat", { seq: 2, data: { id: "chat_new", kind: "project", project: "new" } });
  backend.push("chat", { seq: 3, data: { id: "chat_p", routing: { mode: "agent" }, model: "live" } });
  backend.push("chat", { seq: 4, data: { id: "chat_retired", retired_at: "2026-01-01T00:00:00Z" } });
  await until(() => world.state.projects.find((p) => p.id === "demo")?.routing?.mode === "agent");
  listing.resolve(before);
  await refresh;
  assert.deepEqual(world.state.projects.map((p) => p.id).sort(), ["demo", "new"]);
  const project = world.state.projects.find((p) => p.id === "demo");
  assert.equal(project.routing.mode, "agent");
  assert.equal(project.pin.model, "live");
});

test("a public refresh waiting on a retired cycle does not start reads in the replacement cycle", async (t) => {
  const listing = held();
  const backend = fakeBackend();
  const { world } = await boot(backend);
  t.after(() => { world.dispose(); listing.resolve(chats); });
  backend.routes["GET " + chatPath] = listing.read;
  const refresh = world.act.refresh();
  await until(() => backend.count("GET", chatPath) === 2);
  backend.routes["GET " + chatPath] = chats;
  backend.push("reset", { data: { reason: "retention", from_seq: 6 } });
  backend.end();
  await until(() => backend.count("GET", threadsPath) === 2);
  await settle();
  let publications = 0;
  const stop = world.subscribe(() => { publications++; });
  listing.resolve(chats);
  await refresh;
  await settle();
  stop();
  assert.equal(backend.count("GET", threadsPath), 2);
  assert.equal(publications, 1);
});
