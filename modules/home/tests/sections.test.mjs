// node modules/home/tests/sections.test.mjs: Home draws each home.section entry into its element, in the place's order, mounting it once.
import assert from "node:assert/strict";
import { createKernel } from "../../../core/kernel/index.js";
import { definePlaces } from "../../../shell/places.js";
import { drawSections } from "../sections.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

/** A body holding elements by id, in the order given; querySelector answers `:scope > #id`. */
const bodyOf = (ids) => {
  const els = new Map(ids.map((id) => [id, { id, html: "", made: 0 }]));
  return { els, querySelector: (sel) => els.get(/^:scope > #(.+)$/.exec(sel)?.[1]) || null };
};
t("sections draw in the place's order, whatever the body's; one without an element is passed over; no body draws nothing", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  const calls = [];
  for (const [id, order] of [["hm-b", 20], ["hm-a", 10], ["hm-c", 30]]) kernel.places.contribute("home.section", { id, order, mount() {}, render: (el, c) => { calls.push(id); el.html = c.needs.length; } }, "test");
  const body = bodyOf(["hm-b", "hm-a"]);
  drawSections(kernel.places, /** @type {any} */ (body), { needs: [1, 2], patch: () => false });
  assert.deepEqual(calls, ["hm-a", "hm-b"]);
  assert.equal(body.els.get("hm-a").html, 2);
  drawSections(kernel.places, null, { needs: [], patch: () => false });
  assert.deepEqual(calls, ["hm-a", "hm-b"]);
});
t("each element is mounted once, however often Home draws", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  let mounts = 0, renders = 0;
  kernel.places.contribute("home.section", { id: "hm-x", mount() { mounts++; }, render() { renders++; } }, "test");
  const body = bodyOf(["hm-x"]);
  for (let i = 0; i < 3; i++) drawSections(kernel.places, /** @type {any} */ (body), { needs: [], patch: () => false });
  assert.equal(mounts, 1);
  assert.equal(renders, 3);
});
t("the place refuses a section without mount", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  assert.throws(() => kernel.places.contribute("home.section", { id: "hm-y", render() {} }, "test"), /mount must be a function/);
});
console.log(`\n${passed} passed`);
