// Cascade layers against plain load order: which contests a sheet's @layer would turn, for the app's own sheets and the vendored ones it loads.
import { readFileSync } from "node:fs";
import { spec, cmp } from "./cascade.mjs";
import { sourcePaths, readSource } from "./sources.mjs";

const ROOT = new URL("../../", import.meta.url);
export const ORDER = ["reset", "tokens", "foundation", "components", "shell", "modules", "apps", "theme", "density", "phone"];
const SHORTHANDS = ["margin", "padding", "border", "background", "font", "transition", "animation", "outline", "overflow", "flex", "grid", "gap", "inset", "list-style", "text-decoration", "scroll-margin", "scroll-padding", "mask", "columns", "place-items", "place-content", "place-self"];
const LONG = { gap: ["row-gap", "column-gap"], inset: ["top", "right", "bottom", "left"], "place-items": ["align-items", "justify-items"], "place-content": ["align-content", "justify-content"], "place-self": ["align-self", "justify-self"] };

/** Do two properties set the same thing (the same name, or a shorthand and one of its longhands)? @param {string} a @param {string} b */
export function related(a, b) {
  a = a.replace(/^-(webkit|moz)-/, ""); b = b.replace(/^-(webkit|moz)-/, "");
  if (a === b) return true;
  const has = (/** @type {string} */ s, /** @type {string} */ l) => SHORTHANDS.includes(s) && (l.startsWith(s + "-") || (LONG[s] || []).includes(l));
  return has(a, b) || has(b, a);
}

const split = (/** @type {string} */ s) => { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === "," && !d) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean); };

/** @typedef {{ sheet: string, sel: string, p: string, v: string, imp: boolean, layer: string | null, n: number }} Decl */

/** Every declaration of the page's stylesheets in load order, each with the layer it sits in (null: unlayered). @param {string[]} [extra] vendored sheets loaded later, by path */
export function declarations(extra = []) {
  const html = readFileSync(new URL("index.html", ROOT), "utf8");
  const links = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1]).concat(extra);
  /** @type {Decl[]} */
  const out = [];
  let n = 0;
  /** @param {string} path @param {string | null} layer */
  const read = (path, layer) => {
    const url = new URL(path, ROOT);
    let css = readFileSync(url, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    css = css.replace(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:layer\(([\w.-]+)\))?\s*;/g, (_, href, l) => { read(new URL(href, url).pathname.slice(ROOT.pathname.length), l || layer); return ""; });
    css = css.replace(/@layer\s+[\w.,\s-]+;/g, "");
    /** @type {{ pre: string, layer: string | null }[]} */
    const stack = [];
    let i = 0, start = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === "{") {
        const pre = css.slice(start, i).trim();
        if (/^@(-webkit-)?keyframes|^@font-face|^@property/.test(pre)) { let d = 1, j = i + 1; while (d) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; } i = j; start = j; continue; }
        if (pre.startsWith("@")) { const m = /^@layer\s+([\w.-]+)/.exec(pre); stack.push({ pre, layer: m ? m[1] : null }); start = i + 1; }
        else {
          const end = css.indexOf("}", i), body = css.slice(i + 1, end);
          const at = [...stack].reverse().find((s) => s.layer)?.layer ?? layer;
          for (const sel of split(pre)) for (const x of body.split(";")) {
            const k = x.indexOf(":");
            if (k < 0) continue;
            const p = x.slice(0, k).trim(), v = x.slice(k + 1).trim();
            if (p && v) out.push({ sheet: path, sel, p, v: v.replace(/\s*!\s*important\s*$/, ""), imp: /!\s*important\s*$/.test(v), layer: at, n: n++ });
          }
          i = end; start = end + 1;
        }
      } else if (c === "}") { stack.pop(); start = i + 1; }
      i++;
    }
  };
  for (const l of links) read(l, null);
  return out;
}

/** Classes the app draws together on one element, read from its class attributes and className strings. */
export function together() {
  /** @type {Map<string, Set<string>>} */
  const with_ = new Map();
  const text = [readFileSync(new URL("index.html", ROOT), "utf8"), ...sourcePaths(".js").map(readSource)].join("\n");
  for (const m of text.matchAll(/class(?:Name)?\s*[=:]\s*["'`]([^"'`]*)["'`]/g)) {
    const names = m[1].split(/\s+|\$\{[^}]*\}/).filter((x) => /^[\w-]+$/.test(x));
    for (const a of names) { if (!with_.has(a)) with_.set(a, new Set()); for (const b of names) /** @type {Set<string>} */ (with_.get(a)).add(b); }
  }
  for (const m of text.matchAll(/classList\.(?:add|toggle)\(\s*["']([\w-]+)["']/g)) if (!with_.has(m[1])) with_.set(m[1], new Set([m[1]]));
  return with_;
}

const subject = (/** @type {string} */ sel) => { const flat = sel.replace(/\((?:[^()]|\([^()]*\))*\)/g, (m) => m.replace(/[\s>+~]/g, "_")); const parts = flat.split(/\s*[\s>+~]\s*/); return parts[parts.length - 1]; };
const tag = (/** @type {string} */ c) => (c.match(/^[a-zA-Z][\w-]*/) || [null])[0];
const pseudo = (/** @type {string} */ c) => (c.match(/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+|first-line|first-letter)/) || [null])[1];
const marks = (/** @type {string} */ c) => new Set(c.replace(/:(where|not)\((?:[^()]|\([^()]*\))*\)/g, "").match(/[.#][\w-]+/g) || []);

/** Could two selectors style the same element (or the same pseudo-element)? Classes count as one element only when the app draws them together. @param {string} a @param {string} b @param {Map<string, Set<string>>} drawn */
export function sameElement(a, b, drawn) {
  const sa = subject(a), sb = subject(b);
  if (pseudo(sa) !== pseudo(sb)) return false;
  const ta = tag(sa), tb = tag(sb);
  if (ta && tb && ta !== tb) return false;
  const root = (/** @type {string} */ x) => /^:root\b|^html\b/.test(x);
  if ((root(sa) && tb && tb !== "html") || (root(sb) && ta && ta !== "html")) return false;
  const A = marks(sa), B = marks(sb);
  if (!A.size || !B.size) return true;
  for (const x of A) for (const y of B) {
    if (x === y) return true;
    if (x[0] === "." && y[0] === "." && drawn.get(x.slice(1))?.has(y.slice(1))) return true;
  }
  return false;
}

const rank = (/** @type {string | null} */ l) => (l == null ? ORDER.length : ORDER.indexOf(l));
/** Does b beat a by plain load order (importance, specificity, order)? @param {Decl} a @param {Decl} b */
const beatsPlain = (a, b) => (a.imp !== b.imp ? b.imp : cmp(spec(b.sel), spec(a.sel)) > 0 || (cmp(spec(b.sel), spec(a.sel)) === 0 && b.n > a.n));
/** Does b beat a with layers (importance, then layer, reversed for !important, then specificity and order)? @param {Decl} a @param {Decl} b */
const beatsLayered = (a, b) => {
  if (a.imp !== b.imp) return b.imp;
  const ra = rank(a.layer), rb = rank(b.layer);
  if (ra !== rb) return a.imp ? rb < ra : rb > ra;
  return beatsPlain(a, b);
};

/** The contests the layers turn: same element, related property, a different value, and a different winner than load order gives. @param {Decl[]} all */
export function turned(all, drawn = together()) {
  /** @type {Map<string, Decl[]>} */
  const byProp = new Map();
  const family = (/** @type {string} */ p) => { const q = p.replace(/^-(webkit|moz)-/, ""); return SHORTHANDS.find((s) => q === s || related(s, q)) || q; };
  for (const d of all) { const f = family(d.p); if (!byProp.has(f)) byProp.set(f, []); /** @type {Decl[]} */ (byProp.get(f)).push(d); }
  const out = [];
  for (const list of byProp.values()) {
    const layered = list.filter((d) => d.layer != null);
    for (const a of layered) for (const b of list) {
      if (a === b || (b.layer === a.layer && b.layer != null && b.n < a.n) || !related(a.p, b.p) || a.v === b.v) continue;
      const [x, y] = a.n < b.n ? [a, b] : [b, a];
      if (beatsPlain(x, y) === beatsLayered(x, y)) continue;
      if (!sameElement(x.sel, y.sel, drawn)) continue;
      out.push(`${x.sheet} ${x.sel} {${x.p}:${x.v}${x.imp ? " !important" : ""}} vs ${y.sheet} ${y.sel} {${y.p}:${y.v}${y.imp ? " !important" : ""}}`);
    }
  }
  return [...new Set(out)];
}
