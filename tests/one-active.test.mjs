// A list whose active row the keyboard moves (aria-activedescendant on its field: the @ recipients, Jump) shows one
// active row: the mouse moves that row too, and :hover never paints a second one like it (Astra C058 on 517af1c:
// hovering the second recipient painted it as the keyboard's first, and Enter took the first). The menus share it
// through keynav.js's pointerFollows (tests/keynav.test.mjs). No browser.
//   node tests/one-active.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

for (const [list, cls, el] of [["the @ recipients", ".at-list", "atList"], ["Jump", ".jump-list", "jl"]]) {
  t(`${list}: :hover doesn't paint a row as active, and a moving mouse makes its row the active one`, () => {
    const rules = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1]).filter((s) => s.includes(cls));
    const bad = rules.filter((s) => s.split(",").some((x) => /:hover/.test(x)) && s.split(",").some((x) => /aria-selected/.test(x)));
    assert.deepEqual(bad, [], "no rule paints :hover and the active row alike");
    assert.match(app, new RegExp(`${el}\\.addEventListener\\("pointermove"`), `${el} follows the pointer`);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
