
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FLAVOURS } from "../../core/ui/flavours.js";
import { paletteValue } from "./palette.mjs";

export { FLAVOURS };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** XO's own mark: it stays as Stone has it. */
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
const hexOf = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** How far words follow their surfaces when a flavour moves those toward them (dark lifted, light dimmed). */
const INK_LIFT = 0.8;
export function tint(rgb, look, dark) {
  const { chroma, lift = 0, ink = 1, canvas } = look;
  const L0 = toOklab(rgb)[0];
  const word = dark ? L0 >= 0.5 : L0 < 0.5;
  const toward = dark ? Math.max(0, lift) : Math.min(0, lift);
  let L = Math.min(1, Math.max(0, L0 + (word ? toward * INK_LIFT : lift)));
  // a surface or line never comes closer to the canvas than Stone has it: its contrast with the canvas is kept
  if (!word && lift && canvas != null && L0 !== canvas) {
    const Y = (l) => Math.max(0, l) ** 3, Lof = (y) => Math.cbrt(Math.max(0, y));
    const r = (Y(L0) + 0.05) / (Y(canvas) + 0.05), kept = Lof(r * (Y(canvas + lift) + 0.05) - 0.05);
    L = L0 > canvas ? Math.max(L, kept) : Math.min(L, kept);
  }
  const hue = word ? look.inkHue ?? look.hue : look.hue;
  return oklchRgb(L, word ? look.inkChroma ?? chroma * ink : chroma, hue);
}
/** sRGB at an OKLCH point, chroma cut back until it fits. */
export function oklchRgb(L, C, H) {
  let lo = 0, hi = C;
  if (inGamut(fromOklch(L, hi, H))) lo = hi;
  else for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(fromOklch(L, mid, H))) lo = mid; else hi = mid; }
  return fromOklch(L, lo, H).map((v) => Math.round(gam(Math.min(1, Math.max(0, v))) * 255));
}
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const oklchOf = (hex) => { const [L, a, b] = toOklab(rgbOf(hex)); return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360]; };
const lum = (rgb) => { const c = rgb.map((v) => lin(v / 255)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Coolors' contrast fix: keep hue and chroma, step lightness away from the backgrounds until it reads at min on all. */
export function fix(hex, bgs, min, dark) {
  const [L0, C, H] = oklchOf(hex);
  for (let i = 0; i <= 200; i++) {
    const L = Math.min(1, Math.max(0, L0 + (dark ? i : -i) * 0.005)), rgb = oklchRgb(L, C, H);
    if ((typeof bgs === "function" ? bgs(rgb) : bgs).every((bg) => ratio(rgb, bg) >= min) || L === 0 || L === 1) return hexOf(rgb);
  }
  return hex;
}
const mixHex = (a, b, p) => hexOf(rgbOf(a).map((v, i) => Math.round(v * p + rgbOf(b)[i] * (1 - p))));
const over = (hex, under, p) => rgbOf(hex).map((v, i) => v * p + under[i] * (1 - p));
const shift = (hex, dL) => { const [L, C, H] = oklchOf(hex); return hexOf(oklchRgb(Math.min(1, Math.max(0, L + dL)), C, H)); };

// ── tokens.css ───────────────────────────────────────────────────────────────
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
  const css = ["core/ui/tokens.css", "core/ui/inverse-surfaces.css"]
    .map(file => readFileSync(join(root, file), "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = { main: { dark: [], light: [], inverse: [] }, contrast: { dark: [], light: [], inverse: [] } };
  const take = (text, into) => {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(/,(?![^(]*\))/).map((s) => s.replace(/\s+/g, " ").trim())) {
        const where = sel === ":root" ? "dark" : sel === ':root[data-theme="light"]' ? "light" : sel === ':root[data-theme="light"] .lbx' ? "inverse" : null;
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
  const primitives = new Map(out.main.dark.filter(([key]) => key.startsWith("--dark-")));
  for (const group of Object.values(out)) {
    for (const [scope, rows] of Object.entries(group)) {
      group[scope] = rows.filter(([key]) => !primitives.has(key))
        .map(([key, value]) => [key, paletteValue(value, primitives)]);
    }
  }
  return out;
}

/** A flavour whose main actions are the ink: its hover the ink at its highest, its press a quarter toward the canvas. */

const SEL = {
  dark: (id) => `:root:not([data-theme="light"])[data-flavour="${id}"]`,
  light: (id) => `:root[data-theme="light"][data-flavour="${id}"]`,
  inverse: (id) => `:root[data-theme="light"][data-flavour="${id}"] .lbx`,
};

/** A flavour's look in each mode: light takes the dark look without its lift, then its own light settings. */
const STONE_CANVAS = { dark: 0.1913, light: 0.9851 };
/** A palette flavour's look in a mode: its greys take the background's hue, chroma and lightness, its words the text's hue and chroma. */
function paletteLook(p, mode) {
  const [L, C, H] = oklchOf(p.bg), [, Ci, Hi] = oklchOf(p.fg), lift = L - STONE_CANVAS[mode];
  return { hue: H, chroma: Math.min(C, 0.06), lift: +(mode === "light" ? Math.min(0, lift) : lift).toFixed(4), inkHue: Hi, inkChroma: Math.min(Ci, 0.03), ...(p.look || {}) };
}
export const looks = (f) => {
  if (f.dark) return { dark: paletteLook(f.dark, "dark"), light: paletteLook(f.light, "light") };
  const dark = { hue: f.hue, chroma: f.chroma, lift: f.lift || 0, ink: f.ink ?? 1 }; return { dark, light: { ...dark, lift: 0, ...(f.light || {}) } };
};
const Lof = (hex) => toOklab([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)))[0];

/** Words that must read (4.5:1) and the placeholder (3:1), stepped until they do on every surface the flavour drew. */
const INKS = [["--ink", 4.5], ["--ink-2", 4.5], ["--ink-3", 4.5], ["--ink-4", 4.5], ["--ink-5", 3]];
/** A palette flavour's accent, status hues, bubble and words on tints, each fixed on its own surfaces until it passes. */
export function paletteColours(p, base, dark) {
  const v = (k) => base[k], surf = ["--canvas", "--surface", "--float", "--sunken"].map((k) => rgbOf(v(k)));
  const out = [];
  for (const [k, min] of INKS) out.push([k, fix(v(k), surf, min, dark)]);
  const ink = out[0][1], onInk = v("--on-ink");
  const card = rgbOf(v("--surface")), canvas = rgbOf(v("--canvas")), hover = over(dark ? "#FFFFFF" : "#000000", card, dark ? 0.06 : 0.065);
  const tinted = (rgb) => [card, canvas].map((u) => rgb.map((c, i) => c * 0.12 + u[i] * 0.88));
  const text = (hex, extra = []) => fix(hex, (rgb) => [...surf, hover, ...tinted(rgb), ...extra], 4.5, dark), mark = (hex) => fix(hex, surf, 3, dark);
  // a fill with words on it: the words are whichever ink reads better, the fill steps away from them until both pass
  const filled = (hex) => {
    const f = mark(hex), on = ratio(rgbOf(f), rgbOf(onInk)) >= ratio(rgbOf(f), rgbOf(ink)) ? onInk : ink;
    return [fix(f, [rgbOf(on)], 4.5, on === ink ? !dark : dark), on];
  };
  const accent = text(p.accent), [fill, fillInk] = filled(p.accent);
  const go = text(p.go), [goFill] = filled(p.go), err = mark(p.err), errInk = text(p.err), warn = text(p.warn);
  const rgb = (hex) => rgbOf(hex).join(",");
  out.push(
    ["--accent", accent], ["--accent-fill", fill], ["--accent-ink", fillInk], ["--accent-hover", shift(fill, dark ? 0.04 : -0.04)], ["--accent-press", shift(fill, -0.05)], ["--accent-rgb", rgb(accent)],
    ["--go", go], ["--go-fill", goFill], ["--go-rgb", rgb(go)],
    ["--info", text(p.info)], ["--warn", warn], ["--violet", text(p.violet)], ["--err", err], ["--err-ink", errInk],
    ["--warn-text", text(p.warn, [over(warn, card, 0.2), over(warn, canvas, 0.12)])],
    ["--need-text", text(mixHex(p.warn, ink, 0.4), [over(warn, canvas, 0.12)])],
    ["--ok-text", text(go, [over(goFill, card, 0.28)])],
    ["--danger-ink", text(errInk, [over(errInk, card, 0.26), over(err, card, 0.14)])],
    ["--danger-text", text(mixHex(errInk, ink, 0.7), [over(err, card, 0.14)])],
    ["--add-text", text(mixHex(go, ink, 0.7), [over(go, card, 0.08)])],
    ["--del-text", text(mixHex(errInk, ink, 0.7), [over(err, card, 0.1)])],
    ["--live-h", String(Math.round(oklchOf(p.accent)[2]))],
  );
  // the user's bubble: the accent's hue, deep in dark and pale in light, with the words on it at 7:1
  const [, C, H] = oklchOf(p.accent), you = hexOf(oklchRgb(dark ? 0.39 : 0.885, Math.min(C, dark ? 0.09 : 0.11), H));
  out.push(["--mx-you", fix(you, [rgbOf(ink)], 7, !dark)]);
  return out;
}

export function flavourBlocks(f, s = stone()) {
  const L = looks(f);
  // each mode's canvas, where its surfaces' and lines' contrast is measured from
  L.dark.canvas = Lof(new Map(s.main.dark).get("--canvas"));
  L.light.canvas = Lof(new Map([...s.main.dark, ...s.main.light]).get("--canvas"));
  const re = (list, look, dark) => list.filter(([k, v]) => !KEEP.has(k) && greyOf(v)).map(([k, v]) => { const g = greyOf(v); return [k, g.out(tint(g.rgb, look, dark))]; }).filter(([k, v]) => v !== list.find(([x]) => x === k)[1]);
  const uniq = (list) => [...new Map(list).entries()];
  // light inherits whatever the dark root sets and light doesn't, so its block is taken from the two merged
  const main = { dark: re(uniq(s.main.dark), L.dark, true), light: re(uniq([...s.main.dark, ...s.main.light]), L.light, false), inverse: re(uniq(s.main.inverse), L.dark, true) };
  if (f.dark) {
    const on = (mode, list) => ({ ...Object.fromEntries(list), ...Object.fromEntries(main[mode]) });
    const dk = paletteColours(f.dark, on("dark", s.main.dark), true), lt = paletteColours(f.light, on("light", [...s.main.dark, ...s.main.light]), false);
    const put = (mode, list) => { const m = new Map(main[mode]); for (const [k, x] of list) m.set(k, x); main[mode] = [...m]; };
    put("dark", dk); put("light", lt);
    // the lightbox stays dark in light mode: it takes the dark palette's words and colours
    put("inverse", dk.filter(([k]) => /^--(ink(-\d)?|accent(-rgb)?|go(-rgb)?|err-ink)$/.test(k)));
  }
  const set = new Set([...main.dark, ...main.light].map(([k]) => k));
  // under prefers-contrast every key the flavour sets is said again, so the contrast values still win
  const hc = (list, look, dark) => uniq(list.filter(([k]) => set.has(k) || greyOf(list.find(([x]) => x === k)[1])).map(([k, v]) => { const g = !KEEP.has(k) && greyOf(v); return [k, g ? g.out(tint(g.rgb, look, dark)) : v]; }));
  return { main, contrast: { dark: hc(s.contrast.dark, L.dark, true), light: hc(s.contrast.light, L.light, false), inverse: hc(s.contrast.inverse, L.dark, true) } };
}

/** What a flavour's swatch is painted from, in each mode: Stone's value wherever the flavour leaves it. */
const SWATCH = ["--canvas", "--surface", "--line", "--ink", "--ink-3", "--accent-fill"];
function swatches(f, s) {
  const stoneOf = { dark: Object.fromEntries(s.main.dark), light: Object.fromEntries([...s.main.dark, ...s.main.light]) };
  const b = f ? flavourBlocks(f, s) : { main: { dark: [], light: [] } };
  return Object.fromEntries(["dark", "light"].map((m) => { const own = Object.fromEntries(b.main[m]); return [m, SWATCH.map((k) => [`--sw${k.slice(1)}`, own[k] || stoneOf[m][k]])]; }));
}

const block = (sel, list, pad = "") => list.length ? `${pad}${sel}{\n${pad}  ${list.map(([k, v]) => `${k}:${v}`).join("; ")}\n${pad}}\n` : "";
const GENERATED = "/* Generated by tools/flavours/build.mjs. */\n";

export function source(s = stone()) {
  let out = GENERATED;
  for (const f of FLAVOURS) {
    const b = flavourBlocks(f, s);
    out += `\n/* ${f.name}: ${JSON.stringify(looks(f), (k, v) => (typeof v === "number" ? +v.toFixed(3) : v)).replace(/"/g, "")} */\n`;
    for (const w of ["dark", "light", "inverse"]) out += block(SEL[w](f.id), b.main[w]);
    // the working dots take the flavour's own hue in each mode; a flavour without one keeps Stone's
    if (!f.dark) for (const w of ["dark", "light"]) { const k = looks(f)[w]; if (k.chroma) out += block(SEL[w](f.id), [["--live-h", String(k.hue)]]); }
    const hc = ["dark", "light", "inverse"].map((w) => block(SEL[w](f.id), b.contrast[w], "  ")).join("");
    if (hc) out += `@media (prefers-contrast: more){\n${hc}}\n`;
  }
  return out;
}

export function swatchSource(s = stone()) {
  let out = GENERATED;
  for (const f of [null, ...FLAVOURS]) {
    const sw = swatches(f, s), id = f ? f.id : "stone";
    out += block(`:root:not([data-theme="light"]) .fl-sw[data-sw="${id}"]`, sw.dark) + block(`:root[data-theme="light"] .fl-sw[data-sw="${id}"]`, sw.light);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(join(ROOT, "css/flavours.css"), source());
  writeFileSync(join(ROOT, "css/flavour-swatches.css"), swatchSource());
  console.log("wrote css/flavours.css and css/flavour-swatches.css");
}
