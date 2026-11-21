import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const all = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map(read).join("\n");
const tok = read("tokens.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const i = all.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel); return all.slice(i + sel.length + 2, all.indexOf("}", i)); };

t("a gray button's fill is the ink at 14/18/22% in dark and 7/10/13% in light, translucent on any surface", () => {
  assert.equal((tok.match(/--btn-fill:color-mix\(in srgb,var\(--ink\) 14%,transparent\); --btn-fill-hover:color-mix\(in srgb,var\(--ink\) 18%,transparent\); --btn-fill-press:color-mix\(in srgb,var\(--ink\) 22%,transparent\)/g) || []).length, 2);
  assert.match(tok, /--btn-fill:color-mix\(in srgb,var\(--ink\) 7%,transparent\); --btn-fill-hover:color-mix\(in srgb,var\(--ink\) 10%,transparent\); --btn-fill-press:color-mix\(in srgb,var\(--ink\) 13%,transparent\)/);
});

t("every gray button draws its shape with the fill: a transparent border, no outline colour, no lift", () => {
  for (const sel of [".b", ".btn", ".gear", ".tw-act", ".stg-btn", ".create", ".side-plus"]) {
    const r = rule(sel);
    assert.match(r, /background:var\(--btn-fill\)/, sel);
    assert.doesNotMatch(r, /border:1px solid var\(/, sel);
    assert.doesNotMatch(r, /(^|;)box-shadow:/, sel);
  }
});

t("hover and press go one fill step deeper and never bring a border back", () => {
  for (const sel of [".b:hover", ".tw-act:hover", ".stg-btn:hover", ".create:hover", ".gear:hover"]) {
    const r = rule(sel);
    assert.match(r, /background:var\(--btn-fill-hover\)/, sel);
    assert.doesNotMatch(r, /border-color/, sel);
  }
  assert.doesNotMatch(all, /\.b-(allow|back|reply|done)[^{]*\{[^}]*border-color:var\(--line-strong\)/);
  assert.doesNotMatch(all, /data-theme="light"\] \.gear[^{]*\{[^}]*border-color/);
});

t("Deploy is Apple's tinted style: the accent at 16/22/28% with no rim", () => {
  assert.match(rule(".tw-act.lp-btn"), /background:color-mix\(in srgb,var\(--accent-fill\) 16%,transparent\);border-color:transparent/);
  assert.doesNotMatch(rule(".tw-act.lp-btn:hover"), /border-color/);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
