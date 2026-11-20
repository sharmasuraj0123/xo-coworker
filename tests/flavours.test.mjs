// Flavours (css/flavours.css, tools/flavours/build.mjs): the file is fresh, a flavour only re-tints greys, and every
// flavour in both modes keeps the contrast Stone keeps. No browser.
//   node tests/flavours.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLAVOURS, flavourBlocks, source } from "../tools/flavours/build.mjs";
import { rootProps, color } from "../tools/diffview/theme.mjs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };

const lum = (rgb) => { const c = rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const stone = rootProps();
const palettes = [["stone", "dark", stone.dark], ["stone", "light", stone.light]];
for (const f of FLAVOURS) {
  const b = flavourBlocks(f);
  palettes.push([f.id, "dark", { ...stone.dark, ...Object.fromEntries(b.main.dark) }], [f.id, "light", { ...stone.light, ...Object.fromEntries(b.main.light) }]);
}

t("css/flavours.css is what tools/flavours/build.mjs makes from css/tokens.css (run it after changing a token)", () => {
  assert.equal(read("css/flavours.css"), source());
});
t("it loads right after the tokens, and the mode and flavour are set before the first paint", () => {
  assert.match(read("css/base.css"), /@import url\("\.\/tokens\.css"\);\n@import url\("\.\/flavours\.css"\);/);
  const head = read("index.html").split("</head>")[0];
  assert.match(head, /localStorage\.getItem\("cv-flavour"\)/);
  assert.match(head, /prefers-color-scheme: light/);
  assert.ok(head.indexOf("cv-flavour") < head.indexOf('rel="stylesheet"'), "before any stylesheet");
});
t("Settings › Appearance offers the mode (dark, light, system) and every flavour, from the one list in js/flavours.js", () => {
  const html = read("index.html"), app = read("js/app.js");
  assert.match(html, /id="mode-seg" role="radiogroup" aria-labelledby="mode-l"/);
  assert.match(html, /id="flavour-seg" role="radiogroup" aria-labelledby="flavour-l"/);
  assert.match(app, /import \{ STONE, FLAVOURS \} from "\.\/flavours\.js";/);
  assert.match(app, /\["dark", "Dark"\], \["light", "Light"\], \["system", "System"\]/);
  assert.match(read("tools/flavours/build.mjs"), /import \{ FLAVOURS \} from "\.\.\/\.\.\/js\/flavours\.js";/);
});
t("a flavour never changes a status hue, the accent or the XO mark", () => {
  const fixed = ["--accent", "--accent-fill", "--accent-hover", "--accent-press", "--accent-rgb", "--warn", "--info", "--violet", "--err", "--err-ink", "--coord", "--mark-x", "--mark-o", "--go", "--work", "--need", "--danger"];
  const set = [...read("css/flavours.css").matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
  assert.deepEqual(set.filter((k) => fixed.includes(k)), []);
});

t("a flavour only re-tints what is grey in that mode (a colour light sets over dark's grey stays light's)", () => {
  const grey = (v) => /^#([0-9A-F]{2})\1\1$/i.test(v) || /^rgba\((\d+),\1,\1,[\d.]+\)$/.test(v.replace(/\s+/g, ""));
  const odd = [];
  for (const f of FLAVOURS) {
    const b = flavourBlocks(f);
    for (const [mode, list] of [["dark", b.main.dark], ["light", b.main.light]]) for (const [k] of list) if (!grey(stone[mode][k])) odd.push(`${f.id} ${mode} ${k}: Stone has ${stone[mode][k]}`);
  }
  assert.deepEqual(odd, []);
});

const SURFACES = ["--canvas", "--surface", "--float", "--sunken"];
const pairs = [
  ...["--ink", "--ink-2", "--ink-3", "--ink-4", "--accent", "--warn", "--info", "--violet", "--err-ink"].flatMap((fg) => SURFACES.map((bg) => [fg, bg, 4.5])),
  ...SURFACES.map((bg) => ["--ink-5", bg, 3]),
  ["--accent-ink", "--accent-fill", 4.5], ["--on-ink", "--ink", 4.5],
];
for (const [id, mode, props] of palettes) {
  t(`${id} in ${mode}: words read (4.5:1, placeholders 3:1) and the focus ring shows (3:1)`, () => {
    const low = [];
    for (const [fg, bg, min] of pairs) { const r = ratio(color(`var(${fg})`, props), color(`var(${bg})`, props)); if (r < min) low.push(`${fg} on ${bg} ${r.toFixed(2)} < ${min}`); }
    const canvas = color("var(--canvas)", props), ring = props["--accent-rgb"].split(",").map(Number).map((v, i) => v * 0.75 + canvas[i] * 0.25);
    if (ratio(ring, canvas) < 3) low.push(`focus ring on canvas ${ratio(ring, canvas).toFixed(2)} < 3`);
    assert.deepEqual(low, []);
  });
}

// boundaries: a flavour's lines and raised surfaces stand off its canvas at least about as well as Stone's (the owner,
// 22:58Z: Onyx was too black to see where things end)
const EDGES = [["--line", "--canvas"], ["--line", "--surface"], ["--surface", "--canvas"], ["--float", "--canvas"], ["--line-soft", "--surface"], ["--fill-2", "--surface"], ["--sunken", "--canvas"]];
const stoneEdge = Object.fromEntries(palettes.filter(([id]) => id === "stone").map(([, mode, p]) => [mode, EDGES.map(([a, b]) => ratio(color(`var(${a})`, p), color(`var(${b})`, p)))]));
for (const [id, mode, props] of palettes.filter(([id]) => id !== "stone")) {
  t(`${id} in ${mode}: lines and surfaces keep at least 85% of Stone's step from what they sit on`, () => {
    const low = EDGES.map(([a, b], i) => [a, b, ratio(color(`var(${a})`, props), color(`var(${b})`, props)), stoneEdge[mode][i]]).filter(([, , r, st]) => r - 1 < 0.85 * (st - 1)).map(([a, b, r, st]) => `${a} on ${b} ${r.toFixed(3)} (Stone ${st.toFixed(3)})`);
    assert.deepEqual(low, []);
  });
}

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all passed");
