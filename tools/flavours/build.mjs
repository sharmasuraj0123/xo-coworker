// Flavours: Stone's palette (css/tokens.css) re-tinted. Each grey keeps its OKLCH lightness and takes the flavour's
// hue and chroma, so every contrast stays where Stone put it; status hues and the XO mark are never touched.
//
//   node tools/flavours/build.mjs        writes css/flavours.css
//
// tests/flavours.test.mjs builds the same text and fails when css/flavours.css is stale.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FLAVOURS } from "../../js/flavours.js";

export { FLAVOURS };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Greys that are XO's own mark: they stay as Stone has them. */
const KEEP = new Set(["--mark-x", "--mark-o"]);

// ── OKLCH ────────────────────────────────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toOklab([r, g, b]) {
  [r, g, b] = [r, g, b].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklch(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** How far words follow their surfaces when a flavour moves those toward them (dark lifted, light dimmed). */
const INK_LIFT = 0.8;
/**
 * A grey at Stone's lightness in a look's hue ({hue, chroma, lift, ink}): surfaces move by lift, words follow only
 * when the surfaces come toward them, and words take ink × the chroma. Chroma is cut back until it fits sRGB.
 */
export function tint(rgb, look, dark) {
  const { hue, chroma, lift = 0, ink = 1 } = look;
  let [L] = toOklab(rgb);
  const word = dark ? L >= 0.5 : L < 0.5;
  const toward = dark ? Math.max(0, lift) : Math.min(0, lift);
  L = Math.min(1, Math.max(0, L + (word ? toward * INK_LIFT : lift)));
  let lo = 0, hi = word ? chroma * ink : chroma;
  if (inGamut(fromOklch(L, hi, hue))) lo = hi;
  else for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(fromOklch(L, mid, hue))) lo = mid; else hi = mid; }
  return fromOklch(L, lo, hue).map((v) => Math.round(gam(Math.min(1, Math.max(0, v))) * 255));
}

// ── tokens.css ───────────────────────────────────────────────────────────────
const hexOf = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
function greyOf(value) {
  let m = /^#([0-9a-f]{6})$/i.exec(value);
  if (m) { const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); return r === g && g === b ? { rgb: [r, g, b], out: hexOf } : null; }
  m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(value.replace(/\s+/g, ""));
  if (m && m[1] === m[2] && m[2] === m[3] && !["0", "255"].includes(m[1])) return { rgb: [+m[1], +m[1], +m[1]], out: (rgb) => `rgba(${rgb.join(",")},${m[4]})` };
  return null;
}
const decls = (body) => body.split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }).filter(([k]) => k.startsWith("--"));

/** Stone's palette by where it applies: dark, light, the inverse surface, and the same three under prefers-contrast. */
export function stone(root = ROOT) {
  const css = readFileSync(join(root, "css/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = { main: { dark: [], light: [], inverse: [] }, contrast: { dark: [], light: [], inverse: [] } };
  const take = (text, into) => {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(/,(?![^(]*\))/).map((s) => s.replace(/\s+/g, " ").trim())) {
        const where = sel === ":root" ? "dark" : sel === ':root[data-theme="light"]' ? "light" : sel === ':root[data-theme="light"] :is(.toast,.lbx)' ? "inverse" : null;
        if (where) into[where].push(...decls(m[2]));
      }
    }
  };
  let top = css;
  for (const m of css.matchAll(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    if (/prefers-contrast/.test(m[0])) take(m[1], out.contrast);
    top = top.replace(m[0], "");
  }
  take(top, out.main);
  return out;
}

const SEL = {
  dark: (id) => `:root:not([data-theme="light"])[data-flavour="${id}"]`,
  light: (id) => `:root[data-theme="light"][data-flavour="${id}"]`,
  inverse: (id) => `:root[data-theme="light"][data-flavour="${id}"] :is(.toast,.lbx)`,
};

/** One flavour's blocks: every grey Stone sets in a place, re-tinted, in Stone's order. */
/** A flavour's look in each mode: light takes the dark look without its lift, then its own light settings. */
export const looks = (f) => { const dark = { hue: f.hue, chroma: f.chroma, lift: f.lift || 0, ink: f.ink ?? 1 }; return { dark, light: { ...dark, lift: 0, ...(f.light || {}) } }; };

export function flavourBlocks(f, s = stone()) {
  const L = looks(f);
  const re = (list, look, dark) => list.filter(([k, v]) => !KEEP.has(k) && greyOf(v)).map(([k, v]) => { const g = greyOf(v); return [k, g.out(tint(g.rgb, look, dark))]; }).filter(([k, v]) => v !== list.find(([x]) => x === k)[1]);
  const uniq = (list) => [...new Map(list).entries()];
  // light inherits whatever the dark root sets and light doesn't, so its block is taken from the two merged
  const main = { dark: re(uniq(s.main.dark), L.dark, true), light: re(uniq([...s.main.dark, ...s.main.light]), L.light, false), inverse: re(uniq(s.main.inverse), L.dark, true) };
  const set = new Set([...main.dark, ...main.light].map(([k]) => k));
  // under prefers-contrast every key the flavour sets is said again, so the contrast values still win
  const hc = (list, look, dark) => uniq(list.filter(([k]) => set.has(k) || greyOf(list.find(([x]) => x === k)[1])).map(([k, v]) => { const g = !KEEP.has(k) && greyOf(v); return [k, g ? g.out(tint(g.rgb, look, dark)) : v]; }));
  return { main, contrast: { dark: hc(s.contrast.dark, L.dark, true), light: hc(s.contrast.light, L.light, false), inverse: hc(s.contrast.inverse, L.dark, true) } };
}

/** What a flavour's swatch is painted from, in each mode: Stone's value wherever the flavour leaves it. */
const SWATCH = ["--canvas", "--surface", "--line", "--ink", "--ink-3"];
function swatches(f, s) {
  const stoneOf = { dark: Object.fromEntries(s.main.dark), light: Object.fromEntries([...s.main.dark, ...s.main.light]) };
  const b = f ? flavourBlocks(f, s) : { main: { dark: [], light: [] } };
  return Object.fromEntries(["dark", "light"].map((m) => { const own = Object.fromEntries(b.main[m]); return [m, SWATCH.map((k) => [`--sw${k.slice(1)}`, own[k] || stoneOf[m][k]])]; }));
}

export function source(s = stone()) {
  const block = (sel, list, pad = "") => list.length ? `${pad}${sel}{\n${pad}  ${list.map(([k, v]) => `${k}:${v}`).join("; ")}\n${pad}}\n` : "";
  let out = "/* Generated by tools/flavours/build.mjs from css/tokens.css. Don't edit: change the tokens or the flavours,\n   then run `node tools/flavours/build.mjs`. tests/flavours.test.mjs fails when this is stale. */\n";
  for (const f of FLAVOURS) {
    const b = flavourBlocks(f, s);
    out += `\n/* ${f.name}: ${JSON.stringify(looks(f)).replace(/"/g, "")} */\n`;
    for (const w of ["dark", "light", "inverse"]) out += block(SEL[w](f.id), b.main[w]);
    const hc = ["dark", "light", "inverse"].map((w) => block(SEL[w](f.id), b.contrast[w], "  ")).join("");
    if (hc) out += `@media (prefers-contrast: more){\n${hc}}\n`;
  }
  out += "\n/* each flavour's swatch in Settings › Appearance, in the mode that's on */\n";
  for (const f of [null, ...FLAVOURS]) {
    const sw = swatches(f, s), id = f ? f.id : "stone";
    out += block(`:root:not([data-theme="light"]) .fl-sw[data-sw="${id}"]`, sw.dark) + block(`:root[data-theme="light"] .fl-sw[data-sw="${id}"]`, sw.light);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(join(ROOT, "css/flavours.css"), source());
  console.log("wrote css/flavours.css");
}
