// A shape change XO refused or couldn't take is said once, where it was made; Compact sends nothing and moves nothing.
import assert from "node:assert/strict";
import { shapePage } from "./shape-fixture.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const REFUSED = { why: "refused", text: "A surface id is unknown.", kept: true };
const lines = (P) => [...P.box().querySelectorAll("[data-shp-held]")];
const at = (P) => lines(P).map((x) => P.where(x));

await t("held from before this page: said at its top, once", async () => {
  const P = await shapePage();
  P.hold(REFUSED);
  assert.deepEqual(at(P), ["top"]);
  assert.equal((P.box().textContent.match(/XO refused your last shape change\./g) || []).length, 1, "the words once");
  assert.match(lines(P)[0].textContent, /A surface id is unknown\. It's kept on this device only/);
});

await t("Show everything, then XO refuses: under its row, not at the top", async () => {
  const P = await shapePage();
  await P.press("[data-shp-all]");
  P.hold(REFUSED);
  assert.deepEqual(at(P), ["shp-h-d"]);
});

await t("Compact sends nothing and records nothing: the line stays where the last sent change was made", async () => {
  const P = await shapePage();
  await P.press("[data-shp-all]");
  await P.press("[data-shp-dense]");
  assert.deepEqual(P.shape.sent, ["all"], "Compact is this device's own");
  P.hold(REFUSED);
  assert.deepEqual(at(P), ["shp-h-d"]);
});

await t("a preset chosen, then XO can't be reached: under the cards", async () => {
  const P = await shapePage();
  await P.press('[data-shp-preset="engineering"]');
  P.hold({ why: "unreachable", text: "", kept: true });
  assert.deepEqual(at(P), ["shp-h-p"]);
  assert.match(lines(P)[0].textContent, /Not on your other devices yet: XO couldn't be reached\./);
});

await t("JSON saved, then refused: beside the JSON, after its Save", async () => {
  const P = await shapePage();
  const ta = P.box().querySelector("[data-shp-json]");
  ta.value = '{ "shape": 1, "preset": "marketing" }';
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  await P.press("[data-shp-save]");
  P.hold({ ...REFUSED, kept: false });
  assert.deepEqual(at(P), ["json"]);
  assert.match(lines(P)[0].textContent, /This browser can't keep it after a reload either/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
