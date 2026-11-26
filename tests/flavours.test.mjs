import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLAVOURS, flavourBlocks, source, swatchSource } from "../tools/flavours/build.mjs";
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

t("palette and swatch stylesheets match the generated CSS", () => {
  assert.equal(read("css/flavours.css"), source());
  assert.equal(read("css/flavour-swatches.css"), swatchSource());
});
t("it loads right after the tokens, and the mode and flavour are set before the first paint", () => {
  assert.ok(read("core/ui/foundation.css").includes([
    '@import url("./tokens.css") layer(tokens);',
    '@import url("../../css/flavours.css");',
    '@import url("../../css/flavour-swatches.css");',
  ].join("\n")));
  const head = read("index.html").split("</head>")[0];
  assert.match(head, /localStorage\.getItem\("cv-flavour"\)/);
  assert.match(head, /prefers-color-scheme: light/);
  assert.ok(head.indexOf("cv-flavour") < head.indexOf('rel="stylesheet"'), "before any stylesheet");
});
t("Settings › Appearance offers the mode (dark, light, system) and every flavour, from the shared palette", () => {
  const html = read("shell/overlays.js");
  assert.match(html, /id="mode-seg" role="radiogroup" aria-labelledby="mode-l"/);
  assert.match(html, /id="flavour-seg" role="radiogroup" aria-labelledby="flavour-l"/);
  assert.match(read("tools/flavours/build.mjs"), /import \{ FLAVOURS \} from "\.\.\/\.\.\/core\/ui\/flavours\.js";/);
});
t("the chosen flavour and setting wear the accent's ring, not just a tint", () => {
  const rule = /\.set-choice\.is-on\{([^}]*)\}/.exec(read("modules/settings/configuration.css"))[1];
  assert.match(rule, /border-color:var\(--accent-fill\)/);
  assert.match(rule, /box-shadow:inset 0 0 0 calc\(var\(--stroke-focus\) - var\(--hair\)\) var\(--accent-fill\)/);
});
t("a flavour never changes the XO mark", () => {
  const set = [...read("css/flavours.css").matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
  assert.deepEqual(set.filter((k) => ["--mark-x", "--mark-o"].includes(k)), []);
});
t("a flavour sets its own accent, done green, status hues and your bubble, and they stay apart", () => {
  const near = [];
  for (const f of FLAVOURS) for (const [mode, list] of Object.entries(flavourBlocks(f).main).filter(([m]) => m !== "inverse")) {
    const p = Object.fromEntries(list);
    for (const k of ["--accent", "--accent-fill", "--go", "--go-fill", "--info", "--warn", "--err", "--violet", "--mx-you"]) assert.ok(p[k], `${f.id} ${mode} sets ${k}`);
    for (const [a, b] of [["--accent", "--go"], ["--go", "--info"], ["--go", "--warn"], ["--warn", "--err"]]) {
      const x = color(p[a], p), y = color(p[b], p), d = Math.hypot(...x.map((v, i) => v - y[i]));
      if (d < 30) near.push(`${f.id} ${mode} ${a} ~ ${b} (${d.toFixed(0)})`);
    }
  }
  assert.deepEqual(near, []);
});
t("a flavour only re-tints what is grey in that mode, beside its own palette (a colour light sets over dark's grey stays light's)", () => {
  const grey = (v) => /^#([0-9A-F]{2})\1\1$/i.test(v) || /^rgba\((\d+),\1,\1,[\d.]+\)$/.test(v.replace(/\s+/g, ""));
  const own = new Set(["--accent", "--accent-fill", "--accent-ink", "--accent-hover", "--accent-press", "--accent-rgb", "--go", "--go-fill", "--go-rgb", "--info", "--warn", "--violet", "--err", "--err-ink", "--warn-text", "--need-text", "--ok-text", "--danger-ink", "--danger-text", "--add-text", "--del-text", "--live-h", "--mx-you"]);
  const odd = [];
  for (const f of FLAVOURS) {
    const b = flavourBlocks(f);
    for (const [mode, list] of [["dark", b.main.dark], ["light", b.main.light]]) for (const [k] of list) if (!own.has(k) && !grey(stone[mode][k])) odd.push(`${f.id} ${mode} ${k}: Stone has ${stone[mode][k]}`);
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

// Flavour lines and raised surfaces keep Stone's contrast against the canvas.
const EDGES = [["--bubble", "--canvas"], ["--bubble-top", "--canvas"], ["--field-line", "--surface"], ["--track", "--surface"], ["--line", "--canvas"], ["--line", "--surface"], ["--surface", "--canvas"], ["--float", "--canvas"], ["--line-soft", "--surface"], ["--fill-2", "--surface"], ["--sunken", "--canvas"]];
const stoneEdge = Object.fromEntries(palettes.filter(([id]) => id === "stone").map(([, mode, p]) => [mode, EDGES.map(([a, b]) => ratio(color(`var(${a})`, p), color(`var(${b})`, p)))]));
for (const [id, mode, props] of palettes.filter(([id]) => id !== "stone")) {
  t(`${id} in ${mode}: lines and surfaces keep at least 85% of Stone's step from what they sit on`, () => {
    const low = EDGES.map(([a, b], i) => [a, b, ratio(color(`var(${a})`, props), color(`var(${b})`, props)), stoneEdge[mode][i]]).filter(([, , r, st]) => r - 1 < 0.85 * (st - 1)).map(([a, b, r, st]) => `${a} on ${b} ${r.toFixed(3)} (Stone ${st.toFixed(3)})`);
    assert.deepEqual(low, []);
  });
}

// what sits on a tint: a translucent fill (color-mix with transparent, or rgba) laid over the surface under it
const layer = (v, under, props) => {
  const x = v.trim(), r = /^var\((--[\w-]+)\)$/.exec(x);
  if (r) return layer(props[r[1]], under, props);
  let m = /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/.exec(x);
  if (m) { const c = color(m[1], props), p = +m[2] / 100; return c.map((v, i) => v * p + under[i] * (1 - p)); }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(x);
  if (m) { const a = +m[4]; return [m[1], m[2], m[3]].map((v, i) => +v * a + under[i] * (1 - a)); }
  return color(x, props);
};
const oklchRgb = (L, C, H) => {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const g = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((c) => Math.round(255 * Math.min(1, Math.max(0, g(c)))));
};
const live = (props, d) => oklchRgb(+props["--live-l"], +props["--live-c"], +props["--live-h"] + d);
// words on a fill: [words, fill, what the fill sits on]
const FILLED = [
  ["--ink", "--btn-fill", "--surface"], ["--ink", "--btn-fill-press", "--surface"], ["--ink", "--accent-subtle", "--surface"], ["--ink", "--mx-you", "--canvas", 7], ["--ok-text", "--ok-fill", "--surface"], ["--ink", "--ok-fill-press", "--surface"],
  ["--danger-ink", "--danger-fill", "--surface"], ["--danger-ink", "--danger-tint", "--surface"], ["--danger-text", "--danger-tint", "--surface"], ["--del-text", "--danger-wash", "--surface"],
  ["--warn-text", "--need-tint-2", "--surface"], ["--warn-text", "--need-tint", "--canvas"], ["--coord", "--coord-tint", "--surface", 3],
  ["--info", "--hover-fill", "--surface"], ["--ink", "--bubble", "--canvas"], ["--ink", "--bubble-top", "--canvas"], ["--ink", "--bubble-foot", "--canvas"],
  ["--ink", "--field-bg", "--surface"], ["--ink-5", "--field-bg", "--surface", 3],
];
for (const [id, mode, props] of palettes) {
  t(`${id} in ${mode}: the working dots, the running blue, badges and every filled control read`, () => {
    const low = [];
    for (const [fg, fill, on, min = 4.5] of FILLED) {
      const bg = layer(`var(${fill})`, color(`var(${on})`, props), props), r = ratio(color(`var(${fg})`, props), bg);
      if (r < min) low.push(`${fg} on ${fill} over ${on} ${r.toFixed(2)} < ${min}`);
    }
    for (const [st, words] of [["--warn", "--warn-text"], ["--info", "--info"], ["--go", "--ok-text"], ["--err-ink", "--danger-ink"], ["--ink-4", "--ink-3"]]) for (const on of ["--surface", "--canvas"]) {
      const under = color(`var(${on})`, props), bg = layer(`color-mix(in srgb,var(${st}) 12%,transparent)`, under, props), r = ratio(color(`var(${words})`, props), bg);
      if (r < 4.5) low.push(`badge ${words} on ${st} over ${on} ${r.toFixed(2)} < 4.5`);
    }
    for (const d of [-30, 0, 30]) for (const on of ["--canvas", "--surface", "--float"]) { const r = ratio(live(props, d), color(`var(${on})`, props)); if (r < 3) low.push(`working dot ${d} on ${on} ${r.toFixed(2)} < 3`); }
    const rail = ratio(color("var(--sb-side)", props), color("var(--warn)", props));
    if (rail < 4.5) low.push(`the rail's amber count ${rail.toFixed(2)} < 4.5`);
    assert.deepEqual(low, []);
  });
}

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all passed");
