// A refusal or an error said in the viewer's line draws a warning mark, not a clock (the create-project grader:
// "Couldn't copy the path: the browser didn't allow it here" read as a wait under a clock). The clock stays for what
// is a limit, not a refusal: a preview that shows the first part of a file.
//   node tests/refusal-mark.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const ui = read("js/ui.js"), vw = read("js/viewer.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the icon set has the mark: the clock's circle with a mark in it", () => {
  assert.match(ui, /warn: I\('<circle cx="12" cy="12" r="8\.5"\/><path d="M12 7\.5v5\.2M12 16\.4v\.1"\/>'\)/);
});
t("the viewer's refusal line (a refused Copy path, a save refused) and the editor's error line draw it", () => {
  assert.match(vw, /V\.saveError \? `<p class="vw-cut" role="alert">\$\{ICON\.warn\}/);
  assert.match(vw, /line\.innerHTML = `\$\{ICON\.warn\}<span>\$\{esc\(why\)\}<\/span>`;/);
  assert.doesNotMatch(vw, /role="alert">\$\{ICON\.clock\}/, "no alert under a clock");
});
t("a preview that shows the first part of a file keeps its clock (a limit, not a refusal)", () => {
  assert.match(vw, /d\.truncated \? `<p class="vw-cut">\$\{ICON\.clock\}<span>Showing the first/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
