// "Applied for now: this browser won't keep it" is said where you acted, never only at Shape's top (the create-project
// grader on 8a4ed16, C104/C105/C106: on a phone Reset, Show everything and Compact said it above the viewport, so the
// control looked as if all was well). The warning knows where the change was made and is drawn there, after the
// control (or under the preset cards, where Reset hands focus), then kept in sight by the least move of its scroller.
//   node tests/shape-unkept.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/shapeview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("never at the page's top: the warning is drawn where the change was made", () => {
  assert.doesNotMatch(src, /return \(V\.unkept \? `<p class="set-err" role="alert">\$\{esc\(UNKEPT\)\}<\/p>` : ""\)/, "no top-of-page warning");
  assert.match(src, /const unkeptAt = \(where\) => \(V\.unkept === where \? `<p class="set-err" role="alert" data-shp-unkept>/);
  for (const w of ["preset", "acts", "device"]) assert.match(src, new RegExp(`unkeptAt\\("${w}"\\)`), w);
});
t("each action names its place: Show everything its row, Compact its row, Reset and a preset the cards (where focus goes), Save the JSON", () => {
  assert.match(src, /said\(shape\.resetToPreset\(\), [^\n]*, "preset"\);/);
  assert.match(src, /said\(shape\.showEverything\(\), [^\n]*, "acts"\);/);
  assert.match(src, /said\(shape\.setDevice\(\{ density[^\n]*, "device"\);/);
  assert.match(src, /V\.unkept = r\.kept === false \? "preset" : null;/);
  assert.match(src, /V\.unkept = res\.kept === false \? "json" : null;/);
  assert.match(src, /V\.unkept === "json" && V\.draft == null \? UNKEPT : null/, "Save: said in the JSON's status, beside the text");
});
t("once drawn, it's kept in sight beside what you did (its scroller's least move, never the page's top)", () => {
  assert.match(src, /const inSightUnkept = \(\) => \{ const w = V\.unkept && box\.querySelector\("\[data-shp-unkept\]"\); if \(w\) bringWhole\(w\); \};/);
  assert.match(src, /render\(\);\n\s*inSightUnkept\(\);/, "after said()'s render");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
