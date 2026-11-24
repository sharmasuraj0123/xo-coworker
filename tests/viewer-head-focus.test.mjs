// The viewer's head is drawn anew (paintHead: an edit's Save and Cancel, the "file that runs code" question, ⋯'s
// menu), and the control under the keyboard goes with it: the viewer holds focus first, in the same step, and the same
// control or what follows it takes it back (the controls grader on 8aa58d3, S134 Cancel and S135 Save: BODY 11/11, the
// editor taking a moment to). Fixed where the head is replaced, not in a shared redraw (the lesson of 5d83681).
//   node tests/viewer-head-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAIN_LAYERS } from "../shell/overlays.js";
import { dom } from "./lib/dom.mjs";
const v = readFileSync(new URL("../modules/files/viewer-head.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("paintHead holds focus on the viewer before the head it was in is replaced", () => {
  const ph = v.slice(v.indexOf("function paintHead() {"), v.indexOf("function headFocus("));
  assert.match(ph, /if \(ae && top\.contains\(ae\)\) el\.focus\(\{ preventScroll: true \}\);\s*redrawNode\(top, head\(\)\);/); // in place (the owner, 19 Nov)
});
const { document } = await dom(MAIN_LAYERS);
t("the viewer can hold it: a dialog that takes focus (tabindex -1)", () => {
  const viewer = document.querySelector("#viewer");
  assert.equal(viewer.getAttribute("role"), "dialog");
  assert.equal(viewer.getAttribute("aria-labelledby"), "vw-h");
  assert.equal(viewer.getAttribute("tabindex"), "-1");
  assert.ok(viewer.hidden);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
