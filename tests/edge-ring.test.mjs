// A control at the top of the screen keeps its whole ring: Files' head is the screen's top when Files covers a phone,
// and the main column's top clips it, so its controls draw their rings inside them (the controls grader on 8aa58d3,
// S070: Back · Artifacts at y=2, its ring 4 px out, the top lost at 390). The browser check is the ring sweep, which
// reads the screen's edges as a clip now and sweeps Files over Artifacts (flows RINGCLIP, four cells).
//   node tests/edge-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const fv = read("css/fileview.css").replace(/\/\*[\s\S]*?\*\//g, ""), H = read("tests/browser/harness.cjs"), F = read("tests/browser/flows.test.cjs");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("every control in Files' head draws its ring inside it: the icon buttons, Back, Back to chat", () => {
  assert.match(fv, /\.fv-ib:focus-visible\{outline:2px solid var\(--ring-in,var\(--focus\)\);outline-offset:-2px\}/);
  assert.match(fv, /\.fv-h \.fv-back:focus-visible\{outline-offset:-2px;outline-color:var\(--ring-in,var\(--focus\)\)\}/);
  assert.match(fv, /\.fv-ret:focus-visible\{outline:2px solid var\(--ret-ink\);outline-offset:-2px\}/);
  // and none of them is drawn outside anywhere
  assert.doesNotMatch(fv, /\.fv-(back|ret|ib)[^{]*:focus-visible[^{]*\{[^}]*outline-offset:[0-9]/);
});
t("the ring sweep counts the screen's edges as a clip, and reads Files over Artifacts", () => {
  assert.match(H, /at the screen's edge/);
  assert.match(H, /if \(ring\.top < -0\.5 && r\.top >= -0\.5\) vs\.push\("top"\);/);
  assert.match(F, /await sweep\("Files over Artifacts"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
