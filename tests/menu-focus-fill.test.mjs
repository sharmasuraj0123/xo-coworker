// A menu marks its focused item with a fill (the owner, 11 Nov 05:42Z: keep the fill as the focus mark, make it clearly
// visible in dark). In dark it was --fill-2, #232323 on the float's #1E1E1E: 15 RGB-sum, under the graders' 30 (C088,
// S129, S130: the viewer's More on a phone). Every menu's focused item takes --menu-focus, which keeps clear of its float
// in every theme block.
//   node tests/menu-focus-fill.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const all = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map(css).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

t("every menu's focused item is filled with --menu-focus, never a fill a step off its float", () => {
  const rules = [...all.matchAll(/([^{}]*(?:menu)[^{}]*:focus[^{}]*)\{([^{}]*background[^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));
  assert.ok(rules.length >= 4, `menus with a focus fill: ${rules.length}`);
  const off = rules.filter((r) => !/background:var\(--menu-focus\)/.test(r.body)).map((r) => r.sel);
  assert.deepEqual(off, [], "a menu's focus fill that isn't --menu-focus");
});
t("--menu-focus keeps clear of the float in every theme block: at least 45 RGB-sum, half again past the graders' 30 (dark 78, light 51, unchanged)", () => {
  const tokens = css("tokens.css");
  const blocks = [...tokens.matchAll(/\{([^{}]*--menu-focus:[^{}]*)\}/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 3, `theme blocks with --menu-focus: ${blocks.length}`);
  const darkFloat = /--float:(#[0-9A-Fa-f]{6})/.exec(blocks[0]);
  for (const b of blocks) {
    // an inverse surface's block (the toast, the lightbox: dark in light) takes the dark float
    const f = /--float:(#[0-9A-Fa-f]{6})/.exec(b) || darkFloat, m = /--menu-focus:(#[0-9A-Fa-f]{6})/.exec(b);
    assert.ok(f && m, "float and menu-focus in the same block");
    const d = rgb(f[1]).reduce((s, v, i) => s + Math.abs(v - rgb(m[1])[i]), 0);
    assert.ok(d >= 45, `${m[1]} on ${f[1]}: ${d} RGB-sum`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
