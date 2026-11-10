// The first-run question says what it set up, and only that (the create-project grader on 7e0db5b, S117
// FIRST-RUN-PRESET-503: with the chosen preset's file refused, the sheet closed and announced the preset as done while
// XO showed everything; nothing said otherwise until Settings opened). The choice is kept (it applies once its file
// reads, as Settings' own does); what's said, aloud and on screen, is that it couldn't be read and XO shows everything
// until it can.
//   node tests/first-run-preset.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const sv = read("js/shapeview.js"), app = read("js/app.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("after the choice, a preset whose file couldn't be read is said as such, aloud and on screen, never as set up", () => {
  const d = sv.slice(sv.indexOf("const done = async (id) => {"), sv.indexOf("el._dismiss ="));
  const after = d.slice(d.indexOf("const r = await shape.choose(id);"));
  assert.match(after, /const why = id !== "everything" && shape\.presetError\(id\);/);
  assert.match(after, /if \(why\) \{\s*announce\(`\$\{nameOf\(id\)\} couldn't be read \(\$\{why\}\)\. XO shows everything until it can; Settings › Shape tries again\.`\);\s*notice\(\{ text: `\$\{nameOf\(id\)\} couldn't be read`, sub: "XO shows everything until it can · Settings › Shape tries again" \}\);\s*return;\s*\}/);
  assert.ok(after.indexOf("if (why)") < after.indexOf('announce((id === "everything"'), "the honest line comes first; the usual one only when it read");
});
t("the app shows it as a notice that stays to be read", () => {
  assert.match(sv, /export function createShapeView\(\{ shape, announce = \(\) => \{\}, notice = \(\) => \{\} \}\)/);
  assert.match(app, /createShapeView\(\{ shape: SHAPE, announce, notice: \(n\) => heraldShow\(\{ kind: "stopped", text: n\.text, sub: n\.sub, force: true \}\) \}\)/);
});
t("on a phone a failure notice keeps its reason whole, wrapped to a second row, with an Undo or without", () => {
  const css = read("css/app.css");
  assert.match(css, /@media \(max-width:760px\)\{\s*\.hr-ev\.k-stopped\{flex-wrap:wrap;row-gap:2px;height:auto;min-height:36px;/);
  assert.match(css, /\.hr-ev\.k-stopped \.hr-s\{display:block;order:3;flex:1 1 100%;min-width:0;white-space:normal;overflow:visible\}/);
  assert.doesNotMatch(css, /\.hr-ev\.k-stopped \.hr-s\{[^}]*white-space:nowrap/, "never cut to one line");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
