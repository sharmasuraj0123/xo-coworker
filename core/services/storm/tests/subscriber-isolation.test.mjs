import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorld } from "../../world/store.js";
import { fakeBackend, settle, until } from "../../../../tests/storm-harness.mjs";

test("a throwing subscriber cannot interrupt held-frame replay or the next stream frame", async (t) => {
  const chats = Promise.withResolvers();
  const backend = fakeBackend({ "GET /chat/chats": () => chats.promise });
  const failures = [];
  t.mock.method(console, "error", (error) => failures.push(error));
  const world = createWorld();
  t.after(() => { world.dispose(); chats.resolve({ chats: [] }); });
  const eventError = new Error("broken event subscriber");
  const stateError = new Error("broken state subscriber");
  world.onEvent(() => { throw eventError; });
  const files = [];
  world.onEvent((event) => { if (event.kind === "file") files.push(event.data.path); });
  world.subscribe((state) => { if (state.loaded) throw stateError; });
  const loaded = [];
  world.subscribe((state) => { if (state.loaded) loaded.push(state.lastSeq); });

  backend.push("snapshot", { data: { seq: 1 } });
  await until(() => backend.count("GET", "/chat/chats") === 1);
  backend.push("file.version", { seq: 2, data: { path: "a.txt" } });
  backend.push("file.version", { seq: 3, data: { path: "b.txt" } });
  await settle();
  assert.deepEqual(files, [], "boot is still holding frames");
  chats.resolve({ chats: [] });
  await until(() => world.state.loaded || failures.length > 0);
  assert.deepEqual(files, ["a.txt", "b.txt"], "sibling received every held frame");
  assert.deepEqual(loaded, [3], "throwing state subscriber did not block publication");
  assert.deepEqual(failures, [eventError, eventError, stateError], "each exception was reported once");

  backend.push("file.version", { seq: 4, data: { path: "c.txt" } });
  await until(() => world.state.lastSeq === 4);
  assert.deepEqual(files, ["a.txt", "b.txt", "c.txt"], "the open stream keeps processing");
  assert.deepEqual(failures, [eventError, eventError, stateError, eventError]);
  assert.equal(backend.conns.length, 1, "subscriber failure avoided a transport reconnect");
});

test("an immediate loaded notification reports errors and returns an unsubscribe", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (error) => errors.push(error));
  const backend = fakeBackend();
  const world = createWorld();
  t.after(world.dispose);
  backend.push("snapshot", { data: { seq: 1 } });
  await until(() => world.state.loaded);
  await settle();
  const failure = new Error("broken immediate subscriber");
  const unsubscribe = world.subscribe(() => { throw failure; });
  assert.deepEqual(errors, [failure]);
  assert.equal(unsubscribe(), true);
  await world.act.refresh();
  assert.deepEqual(errors, [failure], "unsubscribed callback no longer runs");
});
