// js/pending.js: a request answers once until it settles; a failure frees it for a retry.
//   node tests/pending.test.mjs
import assert from "node:assert/strict";
import { once, isPending, busyAttrs } from "../js/pending.js";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

await t("a second activation while the first is out joins it: one request", async () => {
  let calls = 0, release;
  const gate = new Promise((ok) => (release = ok));
  const work = () => { calls++; return gate.then(() => "done"); };
  const a = once("rule:x", work), b = once("rule:x", work);
  assert.equal(a, b);
  assert.equal(isPending("rule:x"), true);
  assert.equal(busyAttrs("rule:x"), ' aria-busy="true" aria-disabled="true"');
  release();
  assert.equal(await a, "done");
  assert.equal(calls, 1);
  assert.equal(isPending("rule:x"), false);
  assert.equal(busyAttrs("rule:x"), "");
});
await t("a failure settles and frees the key: the retry sends again", async () => {
  let calls = 0;
  await assert.rejects(once("wt:a", () => { calls++; throw new Error("503"); }), /503/);
  assert.equal(isPending("wt:a"), false);
  assert.equal(await once("wt:a", () => { calls++; return "ok"; }), "ok");
  assert.equal(calls, 2);
});
await t("different keys don't wait on each other", async () => {
  let release;
  const slow = once("a", () => new Promise((ok) => (release = ok)));
  assert.equal(await once("b", () => 2), 2);
  release(1);
  assert.equal(await slow, 1);
});
console.log(`${passed} passed`);
