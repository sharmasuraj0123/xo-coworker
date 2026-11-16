// A record line's Undo never takes focus with it (the create-project grader on 24be023, S004: Undo pressed, the line
// said "undone", focus on BODY in 12 of 12): the line is drawn again without its Undo, so whoever removes it hands
// focus on first: pressed, and its window over. The hand-off is the caller's, not redraw()'s: a hand-off inside
// redraw() to the place around a removed control (8e8e5a4) landed before the callers that put focus on the control
// that follows once a request settles, and they read it as the person having moved on (Settings' Connect, C113/S110).
//   node tests/rec-undo-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), red = read("js/redraw.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("Undo pressed: the conversation takes focus from it before the line is drawn without it", () => {
  assert.match(app, /function recUndoLeaves\(id\) \{\s*const b = document\.activeElement\?\.closest\?\.\(`\[data-rec-undo="\$\{CSS\.escape\(id\)\}"\]`\);\s*if \(b\) placeRegion\(\)\.focus\(\{ preventScroll: true \}\);\s*\}/);
  const u = app.slice(app.indexOf("function undoRecord(id) {"), app.indexOf("function chipRender("));
  assert.ok(u.indexOf("recUndoLeaves(id);") >= 0 && u.indexOf("recUndoLeaves(id);") < u.indexOf("schedule();"), "before the draw");
});
t("its window over: the same, before the draw that takes it away", () => {
  assert.match(app, /if \(rec\.undo\) setTimeout\(\(\) => \{ recUndoLeaves\(m\.id\); schedule\(\); \}, 3050\);/);
});
t("redraw() hands nothing on itself: a removed control's successor is its caller's (Settings' Connect waits for the page)", () => {
  assert.doesNotMatch(red, /around\.find|place\.focus/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
