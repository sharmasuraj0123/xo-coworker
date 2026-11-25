// Builds the icon module from its SVG manifest.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const PACK = new URL("core/ui/icons/source/xo/", ROOT);
const OUT = new URL("core/ui/icons/xoicons.js", ROOT);

const INK = "rgb(29 29 31)";
const PEN = ' fill="none" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" stroke="currentColor"';
const MARK = { "rgb(29 29 31)": "x", "rgb(131 214 58)": "o" };
const TAGS = new Set(["svg", "g", "clipPath", "rect", "path", "ellipse", "circle"]);
const ATTRS = new Set(["xmlns", "width", "height", "viewBox", "id", "clip-path", "transform", "opacity", "d", "x", "y",
  "rx", "ry", "cx", "cy", "r", "fill", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"]);

const num = (s) => s.replace(/-?\d*\.\d+(e-?\d+)?/g, (n) => String(Math.round(parseFloat(n) * 1000) / 1000));

/** One file → { box, body } or throws, naming what isn't allowed. */
export function clean(name, src) {
  const s = String(src).trim();
  if (!/^<svg [^>]*>[\s\S]*<\/svg>$/.test(s)) throw new Error(`${name}: not one <svg> element`);
  for (const m of s.matchAll(/<\/?([A-Za-z][\w:-]*)([^>]*)>/g)) {
    if (!TAGS.has(m[1])) throw new Error(`${name}: <${m[1]}> isn't allowed`);
    for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
      if (!ATTRS.has(a[1])) throw new Error(`${name}: attribute ${a[1]} isn't allowed`);
      if (a[1] === "clip-path" && !/^url\(#[\w-]+\)$/.test(a[2])) throw new Error(`${name}: clip-path ${a[2]}`);
      if (/url\((?!#)|javascript:|data:/i.test(a[2])) throw new Error(`${name}: ${a[1]} points outside the file`);
    }
    if (/[^\s]/.test(m[2].replace(/([\w:-]+)\s*=\s*"[^"]*"/g, "").replace(/\/$/, ""))) throw new Error(`${name}: stray markup in <${m[1]}>`);
  }
  if (/<!|<\?|&/.test(s)) throw new Error(`${name}: entities, comments or processing instructions`);
  const box = /viewBox="([\d. ]+)"/.exec(s)?.[1];
  if (!box) throw new Error(`${name}: no viewBox`);
  let body = s.replace(/^<svg [^>]*>|<\/svg>$/g, "")
    .replace(/<clipPath id="[\w-]+"><rect [^>]*\/><\/clipPath>/g, "");
  // the frame's clip: <g><g clip-path="url(#…)">…</g></g> → …
  const wrap = /^<g><g clip-path="url\(#[\w-]+\)">([\s\S]*)<\/g><\/g>$/.exec(body);
  if (!wrap) throw new Error(`${name}: not Figma's frame wrapper`);
  body = wrap[1];
  if (/clip-path|clipPath|\bid=/.test(body)) throw new Error(`${name}: a clip inside the icon`);
  const mark = name === "xo-mark";
  body = body.replace(/ (fill|stroke)="([^"]+)"/g, (all, k, v) => {
    if (v === "none") return all;
    if (mark && MARK[v]) return ` ${k}="currentColor" class="${MARK[v]}"`;
    return v === INK ? ` ${k}="currentColor"` : all;
  });
  body = body.replace(/<ellipse cx="([^"]+)" cy="([^"]+)" rx="([^"]+)" ry="\3"/g, '<circle cx="$1" cy="$2" r="$3"');
  return { box: num(box), body: num(body) };
}

export function build() {
  const man = JSON.parse(readFileSync(new URL("manifest.json", PACK), "utf8"));
  const out = {};
  for (const ic of man.icons) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(ic.file)) throw new Error(`manifest: odd path ${ic.file}`);
    // an icon is named by its file (the manifest writes the filled ones "home.fill"; their files say "home-fill")
    const name = ic.file.split("/")[1].slice(0, -4);
    if (out[name]) throw new Error(`manifest: ${name} twice`);
    out[name] = clean(name, readFileSync(new URL(ic.file, PACK), "utf8"));
  }
  // the pack's one pen (1.75, round ends and joins) is written once and joined in
  const pen = JSON.stringify(PEN).slice(1, -1);
  const lines = Object.entries(out).map(([k, v]) =>
    `  ${JSON.stringify(k)}: [${JSON.stringify(v.box)}, ${JSON.stringify(v.body).split(pen).join('" + P + "').replace(/ \+ ""/g, "")}],`);
  return "// @ts-check\n\n" +
    `const P = ${JSON.stringify(PEN)};\n` +
    "/** Each icon: [viewBox, inner markup]. @type {Record<string, [string, string]>} */\n" +
    `export const XI = {\n${lines.join("\n")}\n};\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = build();
  if (process.argv.includes("--check")) {
    const now = readFileSync(OUT, "utf8");
    if (now !== s) { console.error("core/ui/icons/xoicons.js is out of date: node tools/xoicons/build.mjs"); process.exit(1); }
    console.log("xoicons: up to date");
  } else { writeFileSync(OUT, s); console.log(`xoicons: ${Object.keys(JSON.parse(readFileSync(new URL("manifest.json", PACK), "utf8")).icons).length} icons → core/ui/icons/xoicons.js (${s.length} bytes)`); }
}
