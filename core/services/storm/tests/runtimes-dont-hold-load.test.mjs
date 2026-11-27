import assert from "node:assert/strict";
import test from "node:test";
import { installLoad } from "../load.js";
import { client } from "../client.js";

test("the world loads without waiting for the runtimes' slow read, and redraws when it lands", async (t) => {
  const runtimes = Promise.withResolvers();
  let redraws = 0;
  const ctx = {
    state: { projects: [{}], review: new Map() }, reads: new AbortController(), chatIdOf() {}, sentAt() {},
    loadRuntimes: () => runtimes.promise, loadSpacePolicy: async () => {}, soon: () => { redraws++; },
  };
  installLoad(ctx);
  ctx.loadChats = async () => {};
  t.mock.method(client, "sessions", async () => ({ sessions: [] }));
  t.mock.method(client, "review", async () => ({ items: [], next_after_seq: null }));
  const loaded = await Promise.race([ctx.loadAll().then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 200))]);
  assert.equal(loaded, true, "loadAll returns while the runtimes are still being read");
  const before = redraws;
  runtimes.resolve();
  await new Promise(setImmediate);
  assert.equal(redraws, before + 1, "the runtimes landing redraws the world");
});
