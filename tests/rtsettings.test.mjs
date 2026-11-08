// Settings › Runtimes (js/rtsettings.js): the "Saved" receipt beside a default.
// Each receipt clears only itself: an earlier save's timer never cuts a newer "Saved" on the same field short
// (Astra on 15bb2fd: ACKs at 0 and 700 ms, and the first timer cleared the second receipt at 1600 ms, 900 ms old).
// No DOM, no network.
//   node tests/rtsettings.test.mjs
import assert from "node:assert/strict";
import { receipts } from "../js/rtsettings.js";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await t("a receipt shows for its time, then goes, and says so once", async () => {
  let cleared = 0;
  const R = receipts(60, () => cleared++);
  assert.equal(R.field, null);
  R.set("default");
  assert.equal(R.field, "default");
  await wait(90);
  assert.equal(R.field, null);
  assert.equal(cleared, 1);
});

await t("a second save on the same field: the first receipt's timer doesn't clear the newer one early", async () => {
  let cleared = 0;
  const R = receipts(160, () => cleared++);
  R.set("default");          // the first ACK, at 0
  await wait(70);
  R.set("default");          // the next ACK, at 70 (Astra's 700 of 1600)
  await wait(120);           // 190: the first timer has fired; the second receipt is only 120 old
  assert.equal(R.field, "default", "the newer Saved still shows");
  assert.equal(cleared, 0, "nothing was cleared under it");
  await wait(80);            // 270: the second receipt's own time is up
  assert.equal(R.field, null);
  assert.equal(cleared, 1);
});

await t("a receipt for another field replaces it, and the earlier timer leaves the new one alone", async () => {
  const R = receipts(120, () => {});
  R.set("fallback");
  await wait(40);
  R.set("default");
  await wait(100); // 140: fallback's timer has fired
  assert.equal(R.field, "default");
});

await t("a new save clears the receipt at once (\"Saving…\" takes its place); its old timer then does nothing", async () => {
  let cleared = 0;
  const R = receipts(60, () => cleared++);
  R.set("default");
  R.clear();
  assert.equal(R.field, null);
  await wait(90);
  assert.equal(cleared, 0, "a receipt already gone isn't cleared again");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
