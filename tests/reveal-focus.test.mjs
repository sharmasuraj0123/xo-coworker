// "Show them" on a long Changes list goes with the rows it reveals: focus goes on to the first of them (the Files
// grader on b920558 and d1c7cb9, S041: Show them replaced, focus to BODY), and the list is drawn in place so a live
// change keeps the row you're on. Checked from the source; drawn, the flows case "S041".
//   node tests/reveal-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/changesframe.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the Changes list is drawn in place", () => {
  assert.match(src, /import \{ redraw \} from "\.\/redraw\.js";/);
  assert.match(src, /const set = \(k, node, html\) => \{ if \(H\[k\] !== html\) \{ redraw\(node, html\); H\[k\] = html; \} \};/);
});
t("Show them notes what was shown, and focus goes to the first row it revealed", () => {
  assert.match(src, /st\.all = true; st\.reveal = new Set\(\[\.\.\.list\.querySelectorAll\("\[data-cx\]"\)\]\.map\(\(r\) => r\.dataset\.cx\)\);/);
  assert.match(src, /const first = \[\.\.\.list\.querySelectorAll\("\[data-cx\]"\)\]\.find\(\(r\) => !was\.has\(r\.dataset\.cx\)\);/);
  assert.match(src, /if \(first && \(!a \|\| a === document\.body \|\| !a\.isConnected \|\| list\.contains\(a\)\)\) first\.focus\(\{ preventScroll: true \}\);/, "only where focus would otherwise be lost (never taken from elsewhere)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
