// A segment the keyboard is on draws its whole ring above its neighbours (the controls grader on 2a8d278, S127, 1440
// dark and light: File selected, Tab onto Changes, and Changes's ring lost its right edge, 26 px on the left and 0 on
// the right, because the selected File after it, 2 px away, painted its background over the ring's outward 2 px at 2 px
// offset). One rule for the segmented controls whose segments sit 2 px apart: the focused one is stacked above them.
//   node tests/seg-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the focused segment is stacked above its neighbours, in the viewer's switches and Routing's", () => {
  assert.ok(/:is\(\.vw-seg,\.rt-seg\)>button:focus-visible\{position:relative;z-index:1\}/.test(css), "the one rule");
  for (const k of ["vw-seg", "rt-seg"]) assert.ok(new RegExp(`\\.${k}\\{[^}]*gap:2px`).test(css), `.${k}'s segments sit 2 px apart (why it's needed)`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
