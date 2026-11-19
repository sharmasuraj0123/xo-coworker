// node tests/home-sections.test.mjs: Home draws Since you left, then Recently made, from the kernel's home.section place.
import assert from "node:assert/strict";
import { createKernel } from "../core/kernel/index.js";
import { definePlaces } from "../shell/places.js";
import { drawSections } from "../modules/home/sections.js";
import { sinceSection } from "../modules/since/section.js";
import { madeSection } from "../modules/artifacts/section.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

/** A body holding elements by id, in the order given; querySelector answers `:scope > #id`. */
const bodyOf = (ids) => {
  const els = new Map(ids.map((id) => [id, { id, html: "", made: 0 }]));
  return { els, querySelector: (sel) => els.get(/^:scope > #(.+)$/.exec(sel)?.[1]) || null };
};
const setup = () => {
  const kernel = createKernel();
  definePlaces(kernel);
  const calls = [];
  const rec = { homeSinceLines: (needs) => { calls.push("since"); return `<p>${needs.length} moved</p>`; }, homeMade: (box) => { calls.push("made"); box.made++; } };
  kernel.places.contribute("home.section", sinceSection(rec), "xo.since");
  kernel.places.contribute("home.section", madeSection(rec), "xo.artifacts");
  const patch = (el, html) => { if (el.html === html) return false; el.html = html; return true; };
  return { kernel, calls, patch };
};

t("Since you left draws its lines through patch, then Recently made draws its strip, whatever the body's order", () => {
  const { kernel, calls, patch } = setup();
  const body = bodyOf(["hm-made", "hm-next", "hm-since"]);
  drawSections(kernel.places, /** @type {any} */ (body), { needs: [1, 2], patch });
  assert.deepEqual(calls, ["since", "made"]);
  assert.equal(body.els.get("hm-since").html, "<p>2 moved</p>");
  assert.equal(body.els.get("hm-made").made, 1);
});
t("a section whose element isn't in the body is passed over; no body draws nothing", () => {
  const { kernel, calls, patch } = setup();
  drawSections(kernel.places, /** @type {any} */ (bodyOf(["hm-since"])), { needs: [], patch });
  assert.deepEqual(calls, ["since"]);
  drawSections(kernel.places, null, { needs: [], patch });
  assert.deepEqual(calls, ["since"]);
});
console.log(`\n${passed} passed`);
