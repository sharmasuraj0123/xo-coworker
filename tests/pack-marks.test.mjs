// Marks are the owner's pack icons, never text characters (■ ◆ ✱ ✓ ○ draw with the font's rough edges).
//   node tests/pack-marks.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../js/", import.meta.url);
const src = readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "xoicons.js").map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("no markup draws a mark with a text character", () => {
  for (const [f, s] of src) {
    const code = s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.doesNotMatch(code, />[■◆✱✓○]</, f);
    assert.doesNotMatch(code, /`[■◆✱]\s/, f);
    assert.doesNotMatch(code, /\? "[✓✱○]" :/, f);
  }
});
t("a step's mark comes from the pack: check, step-doing, state-idle", () => {
  const ui = readFileSync(new URL("ui.js", dir), "utf8");
  assert.match(ui, /doing: xi\("step-doing"\)/);
  assert.match(ui, /todo: xi\("state-idle"\)/);
  assert.match(ui, /export const stepMark = \(s\) => \(s === "done" \? ICON\.check : s === "doing" \? ICON\.doing : ICON\.todo\);/);
});
t("a state mark is the pack's state-* icon, never a CSS-drawn box, ring or diamond", () => {
  for (const [f, s] of src) assert.doesNotMatch(s, /<i class="g /, f);
  const css = ["app.css", "links.css", "phone.css"].map((c) => readFileSync(new URL(`../css/${c}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(css, /(^|\n|\})\.g(-[a-z_]+)?(,\.g-[a-z_]+)*\{[^}]*(border|background|rotate)/);
});
console.log(`\n${passed} passed`);
