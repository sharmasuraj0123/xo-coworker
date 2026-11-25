import assert from "node:assert/strict";
import test from "node:test";
import { installLoad } from "../load.js";
import { client } from "../client.js";

test("review cleanup requires a complete listing and preserves concurrent replacements", async (t) => {
  const review = new Map([["held", {}], ["live", {}]]);
  const ctx = {
    state: { projects: [{}], review }, reads: new AbortController(), chatIdOf() {},
    sentAt() {}, loadRuntimes() {}, loadSpacePolicy() {},
  };
  installLoad(ctx);
  ctx.loadChats = async () => {};
  t.mock.method(client, "sessions", async () => ({ sessions: [] }));
  let complete = false;
  t.mock.method(client, "review", async () => {
    review.set("live", { state: "open" });
    return { items: [], next_after_seq: complete ? null : 1 };
  });
  await ctx.loadAll();
  assert.equal(review.has("held"), true);
  complete = true;
  await ctx.loadAll();
  assert.equal(review.has("held"), false);
  assert.equal(review.has("live"), true);
});
