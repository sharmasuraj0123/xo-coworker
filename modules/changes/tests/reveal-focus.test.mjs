// "Show them" on a long Changes list moves focus to the first row it revealed, and the list is drawn in place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../frame.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the Changes list is drawn in place", () => {
  assert.match(src, /import \{ redraw \} from "\.\.\/\.\.\/core\/ui\/redraw\.js";/);
  assert.match(src, /const set = \([^)]*\bk, [^)]*\bnode, [^)]*\bhtml\) => \{ if \(H\[k\] !== html\) \{ redraw\(node, html\); H\[k\] = html; \} \};/);
});
t("Show them notes what was shown, and focus goes to the first row it revealed", () => {
  assert.match(src, /st\.all = true; st\.reveal = new Set\(.*?\(\[\.\.\.list\.querySelectorAll\("\[data-cx\]"\)\]\)\.map\(\(r\) => r\.dataset\.cx\)\);/);
  assert.match(src, /const first = .*?\(\[\.\.\.list\.querySelectorAll\("\[data-cx\]"\)\]\)\.find\(\(r\) => !was\.has\(r\.dataset\.cx\)\);/);
  assert.match(src, /if \(first && \(!a \|\| a === document\.body \|\| !a\.isConnected \|\| list\.contains\(a\)\)\) first\.focus\(\{ preventScroll: true \}\);/, "only where focus would otherwise be lost (never taken from elsewhere)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
