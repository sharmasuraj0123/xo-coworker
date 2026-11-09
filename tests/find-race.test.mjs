// Find keeps its focus (the controls grader on e55c2d8, S242: Ctrl+End then Ctrl+F at once in a long file left focus in
// the editor; traced on 4198351: __syncRenderView → #ae → #D, whose frame callback focused the caret after Find's own
// focus). When a Find key comes, the wrapper tells the editor to keep focus where it will be, the editor's own rule
// across its redraws (__captureFocusForDOMReplacement): its pending landing then focuses the caret only if the editor
// still holds focus. Deterministic: no timer, no key held, no focus moved back. Checked from the source and from the
// pinned library's own rule; drawn, the flows case "S242 (race)".
//   node tests/find-race.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/diffview.js", import.meta.url), "utf8");
const lib = readFileSync(new URL("../js/vendor/pierre-diffs/edit.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a Find key tells the editor to keep focus where it will be, before the editor sees the key", () => {
  assert.match(src, /const keepFind = \(e\) => \{ if \(!e\.isComposing && findKey\(e\) && typeof ed\.__captureFocusForDOMReplacement === "function"\) ed\.__captureFocusForDOMReplacement\(\); \};/);
  assert.match(src, /\[\["keydown", keepFind, true\], \["keydown", leave, true\]/, "first, in capture: before the editor's own keydown");
  assert.match(src, /const unwire = \(\) => \{[^\n]*\["keydown", keepFind, true\]/, "and removed with the rest");
});
t("no timer, no held key, no focus of its own", () => {
  const i = src.indexOf("const keepFind"), line = src.slice(i, src.indexOf("\n", i));
  assert.doesNotMatch(line, /requestAnimationFrame|setTimeout|preventDefault|dispatchEvent|\.focus\(/);
});
t("the pinned editor's rule it relies on: a landing with focus kept focuses only if the editor still holds focus", () => {
  assert.match(lib, /__captureFocusForDOMReplacement\(\)\{let t=this\.#o,e=this\.#E\?\.shadowRoot\?\.activeElement;t!=null&&\(this\.#k\|\|e===t\|\|e!=null&&t\.contains\(e\)\)&&\(this\.#S=\{\}\)\}/, "it marks the editor's focus as kept");
  assert.match(lib, /this\.#S!==void 0\?this\.#oe\(a\):this\.#D\(a\)/, "a pending landing takes the kept path");
  assert.match(lib, /if\(n==null\|\|!this\.#xe\(n\)\)\{this\.#S=void 0,this\.#k=!1;return\}/, "which focuses nothing when the editor doesn't hold focus");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
