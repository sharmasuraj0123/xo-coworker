// A card's Details toggle finds its section by the closest [data-dis] round it, never by its parent: the rebuild put
// the button in the chips row, and a parent lookup read nothing, so every click on Details did nothing.
//   node tests/details-toggle.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/decide.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a press on Details toggles the section that holds it, wherever the button sits inside it", () => {
  assert.match(src, /classList\.contains\("dis-h"\)\) \{ toggleDis\(el, b\.closest\("\[data-dis\]"\)\.dataset\.dis, n, step\)/);
  assert.doesNotMatch(src, /parentElement\.dataset\.dis/);
});
t("every Details button is drawn inside a [data-dis] section", () => {
  const sections = src.match(/<div class="dis[^"]*"[^>]*data-dis="\w+">[\s\S]*?class="dis-h"/g) || [];
  const buttons = src.match(/class="dis-h"/g) || [];
  assert.ok(buttons.length > 0);
  assert.equal(sections.length, buttons.length);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
