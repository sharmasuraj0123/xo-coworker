// A pressed control's secondary words keep 4.5:1 on the press fill (the create-project grader on 70375ad, C048
// chat-held-contrast: a Chats row's meta, #878787 at 12 px, fell from 4.79:1 at rest to 3.70:1 over the shared 9% press
// fill). The meta inks have no margin for a fill: on dark --ink-3 is 4.0–4.7:1 and --ink-4 3.6–4.2:1 pressed, on light
// --ink-4 3.9–4.4:1. So whatever press fill a control paints, its secondary inks step up to the second while it's
// pressed (one declaration with the fill: the shared rule's, and each fill of its own). And the Chats row's meta is
// its own: the Changes panel's mark (.ch-m, --ink-4, 500) restyled it by its bare class name.
//   node tests/press-inks.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const files = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css"));
const tokens = read("tokens.css"), found = read("foundation.css"), panel = read("panel.css"), app = read("app.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const LIFT = "--ink-3:var(--ink-2);--ink-4:var(--ink-2)";

t("the shared press fill lifts the secondary inks with it", () => {
  const r = /([^{}]*:where\(:active\))\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important;([^}]*)\}/.exec(found);
  assert.ok(r, "the shared press rule");
  assert.ok(r[2].includes(LIFT), `it declares ${LIFT}`);
});
t("every fill of its own does too", () => {
  const own = files.flatMap((f) => [...read(f).matchAll(/([^{}]*:active[^{}]*)\{([^}]*background:var\(--press-fill\)[^}]*)\}/g)].map((m) => ({ f, sel: m[1].trim(), body: m[2] })));
  assert.ok(own.length >= 4, "the own fills (.create, .iq, .iq-row, .btn)");
  const bare = own.filter((x) => !x.body.includes(LIFT)).map((x) => `${x.f}: ${x.sel}`);
  assert.deepEqual(bare, [], "a press fill without the lift");
});
// the numbers behind it: the second ink keeps 4.5:1 on every base the fill can sit on, the meta inks don't
const block = (re) => { const m = re.exec(tokens); assert.ok(m, String(re)); return m[1]; };
const dark = block(/(?:^|\n):root\{([\s\S]*?)\n\}/), light = block(/:root\[data-theme="light"\]\{([\s\S]*?)\n\}/);
const tok = (b, n) => { const m = new RegExp(`${n}:\\s*([^;]+);`).exec(b); assert.ok(m, n); return m[1].trim(); };
const rgb = (s) => s.startsWith("#") ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.match(/[\d.]+/g).map(Number);
const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fill, base) => base.map((v, i) => v * (1 - fill[3]) + fill[i] * fill[3]);
t("pressed, the second ink keeps 4.5:1 on every base; the meta inks would not", () => {
  for (const [name, b] of [["dark", dark], ["light", light]]) {
    const press = rgb(tok(b, "--press-fill"));
    for (const base of ["--surface", "--canvas", "--sunken", "--float"]) {
      const bg = over(press, rgb(tok(b, base)));
      const two = ratio(rgb(tok(b, "--ink-2")), bg);
      assert.ok(two >= 4.5, `${name} ${base}: --ink-2 ${two.toFixed(2)}`);
    }
    const bg = over(press, rgb(tok(b, "--surface")));
    assert.ok(ratio(rgb(tok(b, "--ink-4")), bg) < 4.5, `${name}: --ink-4 needs the lift`);
  }
});
t("the Chats row's meta is its own: the Changes mark's rules are scoped to its row", () => {
  assert.doesNotMatch(panel, /(^|[},])\s*\.ch-m(\.[\w-]+)?\s*[{,]/, "no bare .ch-m rule in panel.css");
  assert.match(panel, /\.ch-r \.ch-m\{flex:none;font:500 var\(--fs-sm\)\/16px var\(--sans\);color:var\(--ink-4\)\}/);
  assert.match(app, /\.ch-m\{font-size:var\(--fs-sm\);(line-height:16px;)?color:var\(--ink-3\);/, "the meta: --ink-3 at rest (5.4:1 dark)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
