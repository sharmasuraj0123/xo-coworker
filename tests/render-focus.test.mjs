// When a redraw takes away the control that had focus, focus goes to a control that shows its ring, never to the
// viewer's own section, which draws none (the controls grader on 1ed50f6, S125, 390 light and 1440 dark: a retried Copy
// path succeeded while the offered path's field had focus; the field went with the refusal, and in Changes and the
// unavailable-file view render() fell back to #viewer: :focus-visible, no ring). The fallback is where Copy path is
// again (the inline Copy, else ⋯), else headFocus's: Edit, else the head's first control that shows.
//   node tests/render-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = src.indexOf("function render() {"), body = src.slice(i, src.indexOf("\n  }\n", i));

t("render's fallback is a control that draws its ring, by headFocus, never the viewer itself", () => {
  assert.doesNotMatch(body, /\|\| el;\n/, "no bare fallback to the viewer's section");
  assert.match(body, /\|\| headFocus\(false\);/, "headFocus: Edit, else the head's first control that shows");
});
t("the offered path's field gone (its copy went through): focus goes where Copy path is again", () => {
  assert.match(body, /\(was === "\[data-vw-cut-sel\]" && \(shown\(el, "\[data-vw-copy-path\]"\) \|\| shown\(el, "\[data-vw-more\]"\)\)\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
