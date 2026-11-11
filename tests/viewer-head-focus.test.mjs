// The viewer's head is drawn anew (paintHead: an edit's Save and Cancel, the "file that runs code" question, ⋯'s
// menu), and the control under the keyboard goes with it: the viewer holds focus first, in the same step, and the same
// control or what follows it takes it back (the controls grader on 8aa58d3, S134 Cancel and S135 Save: BODY 11/11, the
// editor taking a moment to). Fixed where the head is replaced, not in a shared redraw (the lesson of 5d83681).
//   node tests/viewer-head-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const v = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("paintHead holds focus on the viewer before the head it was in is replaced", () => {
  const ph = v.slice(v.indexOf("function paintHead() {"), v.indexOf("function headFocus("));
  assert.match(ph, /if \(ae && top\.contains\(ae\)\) el\.focus\(\{ preventScroll: true \}\);\s*top\.outerHTML = head\(\);/);
});
t("the viewer can hold it: a dialog that takes focus (tabindex -1)", () => {
  assert.match(readFileSync(new URL("../index.html", import.meta.url), "utf8"), /<section class="viewer" id="viewer" role="dialog" aria-labelledby="vw-h" tabindex="-1" hidden><\/section>/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
