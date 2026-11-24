import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../modules/decisions/card-events.js", import.meta.url), "utf8");
const card = readFileSync(new URL("../modules/decisions/card.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a press on Details toggles the section that holds it, wherever the button sits inside it", () => {
  assert.match(src, /classList\.contains\("dis-h"\)\) \{ toggleDis\(el, [^\n]+b\.closest\("\[data-dis\]"\)\)+\.dataset\.dis, n, step\)/);
  assert.doesNotMatch(src, /parentElement\.dataset\.dis/);
});
t("every Details button is drawn inside a [data-dis] section", () => {
  const sections = card.match(/<div class="dis[^"]*"[^>]*data-dis="\w+">[\s\S]*?class="dis-h"/g) || [];
  const buttons = card.match(/class="dis-h"/g) || [];
  assert.ok(buttons.length > 0);
  assert.equal(sections.length, buttons.length);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
