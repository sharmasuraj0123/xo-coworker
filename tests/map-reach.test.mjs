// Fit shows the drawing as drawn (the map grader on 65e84b7, S207/S082, all four cells: the top's read failed, a
// pointer Fit, and its "Couldn't read it · Try again" stood 4.40 px past the view at 1440 and 5.87 px at 390). The
// layout gives every box 148 px; a note or "N more" is as wide as its words. So the drawing's extent for Fit and for
// the first look is the layout's out to the boxes' real edges, measured once per drawing while the view is on screen,
// and again when the font arrives. Checked from the source; the drawn result is the flows case "S207/S082 (Try
// again)" and the grader's root-error-geometry.
//   node tests/map-reach.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, `function ${name}`); return src.slice(i, src.indexOf("\n  }\n", i)); };

t("the extent reaches the drawn boxes' far edges", () => {
  const b = body("bounds");
  assert.match(b, /querySelectorAll\("\.dg-nodes > \.dg-n"\)/, "every box as drawn");
  assert.match(b, /b\.offsetLeft \+ b\.offsetWidth/, "its right edge, in the drawing's units (no transform)");
  assert.match(b, /b\.offsetTop \+ b\.offsetHeight/, "its foot");
  assert.match(b, /if \(!v \|\| !v\.clientWidth\) return B;/, "hidden, nothing to measure: not cached as zero");
  assert.match(b, /M\.reachKey = M\.layoutKey/, "once per drawing");
});
t("Fit and the first look read it, never the layout's extent alone", () => {
  assert.match(body("fit"), /B = bounds\(\)/, "Fit");
  assert.match(body("frame"), /const B = bounds\(\), F = c\.fitB/, "the first look and its 'drawing grew' check");
  const raw = [...src.matchAll(/(?:const|let)[^;\n]*=\s*M\.bounds\b/g)].map((m) => m[0]);
  assert.deepEqual(raw, ["const B = M.bounds"], "only bounds() itself reads the layout's extent");
});
t("the font arriving measures again", () => {
  assert.match(src, /document\.fonts\.addEventListener\("loadingdone", \(\) => \{ M\.reachKey = ""; \}\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
