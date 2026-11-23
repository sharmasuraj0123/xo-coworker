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

t("Deploy, Done and Allow are Apple's tinted style: the status green at 16/22/28% with no rim, one token set for every flavour", () => {
  assert.match(tok, /--ok-fill:color-mix\(in srgb,var\(--accent-fill\) 16%,transparent\); --ok-fill-hover:color-mix\(in srgb,var\(--accent-fill\) 22%,transparent\); --ok-fill-press:color-mix\(in srgb,var\(--accent-fill\) 28%,transparent\)/);
  assert.match(rule(".tw-act.lp-btn"), /background:var\(--ok-fill\);border-color:transparent/);
  assert.doesNotMatch(rule(".tw-act.lp-btn:hover"), /border-color/);
  assert.match(rule(".b-allow,.b-done"), /background:var\(--ok-fill\)/);
  assert.match(rule(".b-allow:hover,.b-done:hover"), /background:var\(--ok-fill-hover\)/);
});

t("text in a card's Details reads the ui role, as the card's line and its buttons do", () => {
  assert.match(rule(".dt .prose"), /font-size:var\(--fs-ui\);font-weight:var\(--fw-regular\);line-height:var\(--lh-ui\)/);
});

t("no state draws a coloured rim: needs, failed, chosen, destructive and their boxes say it with a tint", () => {
  const rims = [...all.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel, body]) => /(^|;)border(-color)?:[^;]*(--warn|--err|--danger|--accent|accent-rgb|245 166 35|230 131 136)/.test(body)
    && !/\.btn-pri|\.is-pri|\.lp-f\.is-bad|aria-invalid|\.av-w|\.drop-veil|\.dg-|\.sc-dot|\.m-you\.is-failed|\.pr-ic/.test(sel));
  assert.deepEqual(rims.map(([, sel]) => sel.trim()), []);
});

t("a destructive button is a red fill, deeper on hover and press, with no outline", () => {
  assert.match(rule(".btn-danger"), /background:var\(--danger-fill\);border-color:transparent/);
  assert.equal((tok.match(/--danger-fill:color-mix\(in srgb,var\(--err-ink\) \d+%,transparent\); --danger-fill-hover:[^;]+; --danger-fill-press:[^;]+;/g) || []).length, 3);
});

t("keyboard focus is a soft accent ring hugging the control", () => {
  assert.match(read("base.css"), /(^|\n):focus-visible\{outline:3px solid var\(--focus\);outline-offset:0\}/);
  assert.equal((tok.match(/--focus:rgba\(var\(--accent-rgb\),\.4\); --focus-halo:rgba\(var\(--accent-rgb\),\.2\);/g) || []).length, 2);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
