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

test("one unreadable review item is dropped and said; the rest of the list loads", async (t) => {
  const review = new Map();
  const rejectedFrames = new Map();
  const ctx = {
    state: { projects: [{}], review, rejectedFrames }, reads: new AbortController(), chatIdOf() {},
    sentAt() {}, loadRuntimes() {}, loadSpacePolicy() {},
  };
  installLoad(ctx);
  ctx.loadChats = async () => {};
  t.mock.method(client, "sessions", async () => ({ sessions: [] }));
  t.mock.method(client, "review", async () => ({
    items: [{ id: "bad", state: "open", detail: { questions: [{ header: 3 }] } }, { id: "good", state: "open" }],
    next_after_seq: null,
  }));
  const said = t.mock.method(console, "error", () => {});
  await ctx.loadAll();
  assert.equal(review.has("good"), true);
  assert.equal(review.has("bad"), false);
  assert.deepEqual([...rejectedFrames.keys()], ["read.review item.detail"]);
  const told = said.mock.calls.map((c) => String(c.arguments[0]?.message)).filter((m) => m.startsWith("Couldn't read one review item"));
  assert.deepEqual(told, ["Couldn't read one review item. Invalid detail."]);
});
