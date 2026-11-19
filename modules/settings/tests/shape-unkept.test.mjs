// A shape change this browser can't keep says so where it was made, never at the page's top: the Shape page on a DOM.
import assert from "node:assert/strict";
import { shapePage } from "./shape-fixture.mjs";
import { settle } from "../../../tests/lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const warning = (P) => P.box().querySelector("[data-shp-unkept]");

await t("Show everything, not kept: said under its own row", async () => {
  const P = await shapePage();
  P.shape.next = { kept: false };
  await P.press("[data-shp-all]");
  assert.equal(P.where(warning(P)), "shp-h-d");
  assert.equal(warning(P).textContent, P.UNKEPT);
  assert.equal(P.box().querySelectorAll("[data-shp-unkept]").length, 1, "said once");
});

await t("Compact, not kept: said in this device's section", async () => {
  const P = await shapePage();
  P.shape.next = { kept: false };
  await P.press("[data-shp-dense]");
  assert.equal(P.where(warning(P)), "shp-h-v");
});

await t("a preset chosen, not kept: said under the cards, where focus goes", async () => {
  const P = await shapePage();
  P.shape.next = { kept: false };
  await P.press('[data-shp-preset="engineering"]');
  assert.deepEqual(P.shape.sent, ["choose:engineering"]);
  assert.equal(P.where(warning(P)), "shp-h-p");
});

await t("JSON saved, not kept: said in the JSON's status beside the text, not up the page", async () => {
  const P = await shapePage();
  P.shape.next = { kept: false };
  const ta = P.box().querySelector("[data-shp-json]");
  ta.value = '{ "shape": 1, "preset": "marketing" }';
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  await P.press("[data-shp-save]");
  assert.deepEqual(P.shape.sent, ["mine"]);
  assert.equal(P.box().querySelector(".shp-status").textContent, P.UNKEPT);
  assert.equal(warning(P), null, "no line elsewhere on the page");
});

await t("the next change that is kept takes the warning away", async () => {
  const P = await shapePage();
  P.shape.next = { kept: false };
  await P.press("[data-shp-all]");
  P.shape.next = { kept: true };
  await P.press("[data-shp-dense]");
  await settle();
  assert.equal(warning(P), null);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
