// A hovered control's secondary words keep 4.5:1 on the hover fill: one shared rule brings the meta inks (--ink-3,
// --ink-4) up to the second while a control is hovered, as the press fill does (C048). The owner's choice, 10 Nov 11:19
// (rv_9ca1ac840683431c), from the measured worst cases: the 6% hover fill drops --ink-4 to 3.9–4.1:1 on dark float and
// surface and on light sunken, --ink-3 to 4.37:1 on dark float. The sidebar's rows keep their own (frozen) look.
//   node tests/hover-inks.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("tokens.css"), found = read("foundation.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one shared rule: a hovered control's meta inks step up to the second; never the sidebar's rows, never a disabled control", () => {
  assert.match(found, /:where\(button,\[role=button\],\[role=tab\],\[role=option\],\[role=menuitem\],\[role=menuitemradio\],summary,\.rt-check\):where\(:hover:not\(:disabled,\[aria-disabled="true"\],\.prow,\.nrow\)\)\{--ink-3:var\(--ink-2\);--ink-4:var\(--ink-2\)\}/);
});
const block = (re) => { const m = re.exec(tokens); assert.ok(m, String(re)); return m[1]; };
const dark = block(/(?:^|\n):root\{([\s\S]*?)\n\}/), light = block(/:root\[data-theme="light"\]\{([\s\S]*?)\n\}/);
const tok = (b, n) => { const m = new RegExp(`${n}:\\s*([^;]+);`).exec(b); assert.ok(m, n); return m[1].trim(); };
const rgb = (s) => s.startsWith("#") ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.match(/[\d.]+/g).map(Number);
const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fill, base) => base.map((v, i) => v * (1 - fill[3]) + fill[i] * fill[3]);
t("hovered, the second ink keeps 4.5:1 on every base, the worst cases included", () => {
  for (const [name, b] of [["dark", dark], ["light", light]]) {
    const fill = rgb(tok(b, "--hover-fill"));
    for (const base of ["--surface", "--canvas", "--sunken", "--float"]) {
      const r = ratio(rgb(tok(b, "--ink-2")), over(fill, rgb(tok(b, base))));
      assert.ok(r >= 4.5, `${name} ${base}: --ink-2 ${r.toFixed(2)}`);
    }
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
