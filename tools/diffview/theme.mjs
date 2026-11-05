// The syntax colours of a diff or a file in Files: XO's code tokens (--code-*, the colours of code in chat,
// css/app.css) worked out to plain hex for each theme, as the TextMate pair xo-dark / xo-light that
// @pierre/diffs highlights with. Pierre's editor recolours the lines you type from concrete colours, so the
// syntax theme can't be CSS variables; everything else in a diff can, and is (css/diffs.css).
//
//   node tools/diffview/theme.mjs        writes js/diffthemes.js
//
// tests/diffview.test.mjs runs the same resolver and fails when the tokens change and the file wasn't
// regenerated. The resolver reads the stylesheets in index.html's order and follows the cascade the way
// the page meets it: `:root` blocks, then `:root[data-theme="light"]` ones on top in light (more specific),
// at-rule blocks (@media and the like) skipped, var() and color-mix(in srgb, …) worked out.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const KEYS = ["ink", "com", "kw", "str", "num", "fn", "bi", "prop", "tag", "pun", "var", "add", "del", "bg"];

/** The page's stylesheets in order, each with its @imports inlined where they stand. */
function sheets(root) {
  const html = readFileSync(join(root, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/(css\/[^"]+)"/g)].map((m) => m[1]);
  const read = (rel) => readFileSync(join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import\s+url\(["']?\.\/([^"')]+)["']?\)\s*;/g, (_, f) => read(join(dirname(rel), f)));
  return hrefs.map(read).join("\n");
}

/** Top-level rules only: every at-rule block is cut out whole. */
function topRules(css) {
  let out = "", depth = 0, skip = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "@" && depth === 0) {
      const brace = css.indexOf("{", i), semi = css.indexOf(";", i);
      if (semi >= 0 && (brace < 0 || semi < brace)) { i = semi; continue; } // @charset, a stray @import
      skip = 0;
    }
    if (c === "{") { depth++; if (skip >= 0) skip++; }
    if (skip < 0) out += c;
    if (c === "}") { depth--; if (skip > 0 && --skip === 0) skip = -1; }
  }
  return [...out.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
}

/** Which theme a selector on the root applies in, and its specificity; null when it isn't the root alone. */
function rootSel(sel) {
  const m = /^:root((?:\[[^\]]+\])*)$/.exec(sel.replace(/\s+/g, ""));
  if (!m) return null;
  const attrs = [...m[1].matchAll(/\[([^\]=]+)(?:=["']?([^"'\]]*)["']?)?\]/g)];
  const theme = attrs.find((a) => a[1] === "data-theme");
  return { theme: theme ? theme[2] : null, spec: 1 + attrs.length };
}

/** {dark, light}: every custom property each theme's root ends up with, unresolved. */
export function rootProps(root = ROOT) {
  const decls = [];
  for (const r of topRules(sheets(root))) {
    for (const sel of r.sel.split(",")) {
      const s = rootSel(sel.trim());
      if (!s) continue;
      for (const d of r.body.split(/;(?![^(]*\))/)) {
        const i = d.indexOf(":");
        const prop = d.slice(0, i).trim();
        if (i > 0 && prop.startsWith("--")) decls.push({ ...s, prop, value: d.slice(i + 1).trim(), order: decls.length });
      }
    }
  }
  const forTheme = (t) => {
    const out = {};
    decls.filter((d) => d.theme == null || d.theme === t).sort((a, b) => a.spec - b.spec || a.order - b.order).forEach((d) => { out[d.prop] = d.value; });
    return out;
  };
  return { dark: forTheme("dark"), light: forTheme("light") };
}

// ── colours ──────────────────────────────────────────────────────────────────
const hex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
function parseHex(s) {
  let h = s.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6) throw new Error(`a colour this resolver can't read: ${s}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
/** Split on top-level commas. */
const args = (s) => { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "(") d++; if (c === ")") d--; if (c === "," && !d) { out.push(cur.trim()); cur = ""; } else cur += c; } out.push(cur.trim()); return out; };

/** A colour value to [r, g, b] (0–255, unrounded), resolving var() against props. */
export function color(value, props, seen = new Set()) {
  const v = value.trim();
  if (/^#[0-9a-f]{3,6}$/i.test(v)) return parseHex(v);
  let m = /^var\((--[\w-]+)(?:,(.*))?\)$/.exec(v);
  if (m) {
    if (seen.has(m[1])) throw new Error(`a var() loop at ${m[1]}`);
    const next = props[m[1]] ?? m[2];
    if (next == null) throw new Error(`${m[1]} isn't declared on the root`);
    return color(next, props, new Set([...seen, m[1]]));
  }
  m = /^color-mix\(\s*in\s+srgb\s*,(.*)\)$/s.exec(v);
  if (m) {
    const [a, b] = args(m[1]).map((part) => { const p = /^(.*?)\s+([\d.]+)%$/.exec(part); return p ? { c: p[1], p: +p[2] / 100 } : { c: part, p: null }; });
    const pa = a.p ?? (b.p != null ? 1 - b.p : 0.5), pb = b.p ?? 1 - pa;
    const ca = color(a.c, props, seen), cb = color(b.c, props, seen);
    return ca.map((x, i) => (x * pa + cb[i] * pb) / (pa + pb));
  }
  throw new Error(`a colour this resolver can't read: ${v}`);
}

/** {dark, light}: each --code-* token as hex. */
export function codeColors(root = ROOT) {
  const p = rootProps(root);
  const of = (props) => Object.fromEntries(KEYS.map((k) => [k, hex(color(`var(--code-${k})`, props))]));
  return { dark: of(p.dark), light: of(p.light) };
}

/** A TextMate theme from the code colours: the scopes js/highlight.js colours, mapped onto TextMate's. */
export function textmate(name, type, c) {
  const s = (scope, foreground, fontStyle) => ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } });
  return {
    name, type,
    colors: { "editor.foreground": c.ink, "editor.background": c.bg },
    tokenColors: [
      s(["comment", "punctuation.definition.comment", "string.quoted.docstring"], c.com, "italic"),
      s(["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression", "keyword.operator.logical.python", "variable.language.this", "variable.language.self"], c.kw),
      s(["keyword.operator", "punctuation", "meta.brace", "meta.delimiter"], c.pun),
      s(["string", "string.quoted", "string.template", "string.regexp", "punctuation.definition.string", "markup.inline.raw", "markup.fenced_code"], c.str),
      s(["constant.numeric", "constant.language", "constant.character", "constant.other", "support.constant", "variable.other.enummember"], c.num),
      s(["entity.name.function", "support.function", "meta.function-call", "entity.name.method", "variable.function"], c.fn),
      s(["support.class", "support.type", "entity.name.type", "entity.name.class", "entity.other.inherited-class", "support.variable", "variable.language", "entity.name.namespace"], c.bi),
      s(["variable.other.property", "variable.other.object.property", "support.type.property-name", "meta.object-literal.key", "entity.other.attribute-name", "meta.property-name"], c.prop),
      s(["entity.name.tag", "meta.tag.sgml", "markup.heading", "entity.name.section"], c.tag),
      s(["variable.parameter", "variable.other.constant", "variable.other.readwrite.alias"], c.var),
      s(["markup.inserted", "punctuation.definition.inserted", "meta.diff.header.to-file"], c.add),
      s(["markup.deleted", "punctuation.definition.deleted", "meta.diff.header.from-file"], c.del),
      s(["markup.bold"], c.ink, "bold"),
      s(["markup.italic"], c.ink, "italic"),
      s(["markup.underline.link", "string.other.link"], c.fn),
    ],
  };
}

export function moduleSource(colors = codeColors()) {
  const dark = textmate("xo-dark", "dark", colors.dark), light = textmate("xo-light", "light", colors.light);
  return `// Generated by tools/diffview/theme.mjs from XO's code tokens (--code-*, css/app.css) in each theme. Don't edit:
// change the tokens, then run \`node tools/diffview/theme.mjs\`. tests/diffview.test.mjs fails when this is stale.
export const XO_DARK = ${JSON.stringify(dark)};
export const XO_LIGHT = ${JSON.stringify(light)};
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const c = codeColors();
  writeFileSync(join(ROOT, "js/diffthemes.js"), moduleSource(c));
  console.log("js/diffthemes.js", JSON.stringify(c));
}
