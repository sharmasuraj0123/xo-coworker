// Cascade layers against plain load order: which contests a sheet's @layer would turn, for the app's own sheets and the vendored ones it loads.
import { fileURLToPath } from "node:url";
import { spec, cmp } from "./cascade.mjs";
import { declarationFiles, stylesheetRows } from "./css-snapshot.mjs";
import { sourcePaths, readSource } from "./sources.mjs";
import { flattenStyles } from "../../tools/conformance/css-flatten.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const ORDER = ["reset", "tokens", "foundation", "components", "shell", "modules", "apps", "theme", "density", "phone"];
const SHORTHANDS = ["margin", "padding", "border", "background", "font", "transition", "animation", "outline", "overflow", "flex", "grid", "gap", "inset", "list-style", "text-decoration", "scroll-margin", "scroll-padding", "mask", "columns", "place-items", "place-content", "place-self"];
const LONG = { font: ["line-height"], gap: ["row-gap", "column-gap"], inset: ["top", "right", "bottom", "left"], "place-items": ["align-items", "justify-items"], "place-content": ["align-content", "justify-content"], "place-self": ["align-self", "justify-self"] };

/** Do two properties set the same thing (the same name, or a shorthand and one of its longhands)? @param {string} a @param {string} b */
export function related(a, b) {
  a = a.replace(/^-(webkit|moz)-/, ""); b = b.replace(/^-(webkit|moz)-/, "");
  if (a === b) return true;
  const has = (/** @type {string} */ s, /** @type {string} */ l) => SHORTHANDS.includes(s) && (l.startsWith(s + "-") || (LONG[s] || []).includes(l));
  return has(a, b) || has(b, a);
}

const split = (/** @type {string} */ s) => { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === "," && !d) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean); };

/** @typedef {{ sheet: string, sel: string, p: string, v: string, imp: boolean, layer: string | null, n: number }} Decl */

/** @param {string[]} [extra] */
export function declarations(extra = []) {
  const files = new WeakMap();
  const rows = extra.length ? flattenStyles(ROOT, "index.html", (row, path) => files.set(row, path), extra) : stylesheetRows;
  /** @type {Decl[]} */
  const out = [];
  for (const row of rows) {
    const selector = row.context.at(-1)?.selector;
    if (!row.property || !selector || row.context.some(({ at }) => /keyframes$/.test(at ?? ""))) continue;
    const sheet = (files.get(row) ?? declarationFiles.get(row)).slice(1);
    const layer = row.context.findLast(({ at }) => at === "layer")?.params ?? null;
    for (const sel of split(selector)) {
      out.push({ sheet, sel, p: row.property, v: row.value, imp: row.important, layer, n: out.length });
    }
  }
  return out;
}

/** What the app draws: the classes it puts together on one element, and the tags each class is drawn on. */
export function drawn(page) {
  /** @type {Map<string, Set<string>>} */
  const peers = new Map();
  /** @type {Map<string, Set<string>>} */
  const tags = new Map();
  const add = (/** @type {Map<string, Set<string>>} */ m, /** @type {string} */ k, /** @type {string} */ v) => { if (!m.has(k)) m.set(k, new Set()); /** @type {Set<string>} */ (m.get(k)).add(v); };
  const text = sourcePaths(".js").map(readSource).join("\n");
  for (const element of page.querySelectorAll("[class]")) {
    for (const name of element.classList) {
      add(tags, name, element.localName);
      for (const peer of element.classList) add(peers, name, peer);
    }
  }
  const names = (/** @type {string} */ v) => v.split(/\s+|\$\{[^}]*\}/).filter((x) => /^[\w-]+$/.test(x));
  for (const m of text.matchAll(/class(?:Name)?\s*[=:]\s*["'`]([^"'`]*)["'`]/g)) { const ns = names(m[1]); for (const a of ns) for (const b of ns) add(peers, a, b); }
  for (const m of text.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*?\sclass="([^"]*)"/g)) for (const c of names(m[2])) add(tags, c, m[1].toLowerCase());
  for (const m of text.matchAll(/(\w+) = document\.createElement\("([\w-]+)"\);[^]{0,200}?\b\1\.className = "([^"]+)"/g)) for (const c of names(m[3])) add(tags, c, m[2]);
  for (const m of text.matchAll(/classList\.(?:add|toggle)\(\s*["']([\w-]+)["']/g)) { add(peers, m[1], "*"); add(tags, m[1], "*"); }
  for (const m of text.matchAll(/className\s*=\s*[^;\n]*/g)) for (const c of m[0].match(/[\w-]+/g) || []) add(tags, c, "*");
  for (const set of tags.values()) if (set.size > 1) set.delete("*");
  return { peers, tags, text, page };
}

const subject = (/** @type {string} */ sel) => { const flat = sel.replace(/\((?:[^()]|\([^()]*\))*\)/g, (m) => m.replace(/[\s>+~]/g, "_")); const parts = flat.split(/\s*[\s>+~]\s*/); return parts[parts.length - 1].replace(/_/g, " "); };
/** A compound as the plain compounds it may be: each :is() or :where() list spread into its alternatives. @param {string} c @returns {string[]} */
const alternatives = (c) => {
  const m = /:(is|where)\(((?:[^()]|\([^()]*\))*)\)/.exec(c);
  if (!m) return [c];
  const list = split(m[2]);
  return list.some((x) => /[\s>+~]/.test(x)) ? [c.replace(m[0], "")] : list.flatMap((x) => alternatives(c.replace(m[0], x)));
};
const tag = (/** @type {string} */ c) => (c.match(/^[a-zA-Z][\w-]*/) || [null])[0];
const pseudo = (/** @type {string} */ c) => (c.match(/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+|first-line|first-letter)/) || [null])[1];
const marks = (/** @type {string} */ c) => new Set(c.replace(/:(not|has)\((?:[^()]|\([^()]*\))*\)/g, "").match(/[.#][\w-]+/g) || []);
/** @typedef {{ peers: Map<string, Set<string>>, tags: Map<string, Set<string>>, text: string, page: Document }} Drawn */

/** Does the app ever draw the attribute values a compound asks for (on a tag, the root aside)? @param {string} c @param {Drawn} d */
const attrsDrawn = (c, d) => !tag(c) || /^(html)$/.test(/** @type {string} */ (tag(c))) || [...c.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "").matchAll(/\[([\w-]+)="([^"]*)"\]/g)].every(([attr, k, v]) => d.page.querySelector(attr) || d.text.includes(`${k}="${v}"`) || d.text.includes(`${k}=\\"${v}\\"`) || d.text.includes(`"${k}", "${v}"`));
const isRoot = (/** @type {string} */ c) => /^:root\b|^html\b/.test(c);

/** Could two compounds be the same element? @param {string} a @param {string} b @param {Drawn} d */
function one(a, b, d) {
  if (pseudo(a) !== pseudo(b) || !attrsDrawn(a, d) || !attrsDrawn(b, d)) return false;
  const ta = tag(a), tb = tag(b);
  if (ta && tb && ta !== tb) return false;
  const A = marks(a), B = marks(b);
  if (isRoot(a) || isRoot(b)) { const o = isRoot(a) ? b : a; return isRoot(o) || (!marks(o).size && !/\[role/.test(o) && (!tag(o) || tag(o) === "html")); }
  const onTag = (/** @type {Set<string>} */ M, /** @type {string | null} */ t) => !t || [...M].every((x) => x[0] !== "." || !d.tags.get(x.slice(1)) || /** @type {Set<string>} */ (d.tags.get(x.slice(1))).has(t) || /** @type {Set<string>} */ (d.tags.get(x.slice(1))).has("*"));
  if (!onTag(A, tb) || !onTag(B, ta)) return false;
  if (!A.size || !B.size) return true;
  const loose = (/** @type {string} */ x) => x[0] === "#" || d.peers.get(x.slice(1))?.has("*");
  for (const x of A) for (const y of B) if (x === y || loose(x) || loose(y) || (x[0] === "." && y[0] === "." && d.peers.get(x.slice(1))?.has(y.slice(1)))) return true;
  return false;
}
/** Could two selectors style the same element (or pseudo-element)? @param {string} a @param {string} b @param {Drawn} d */
export function sameElement(a, b, d) {
  for (const x of alternatives(subject(a))) for (const y of alternatives(subject(b))) if (one(x, y, d)) return true;
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
export function turned(all, d) {
  /** @type {Map<string, Decl[]>} */
  const byProp = new Map();
  const family = (/** @type {string} */ p) => { const q = p.replace(/^-(webkit|moz)-/, ""); return SHORTHANDS.find((s) => q === s || related(s, q)) || q; };
  for (const d of all) { const f = family(d.p); if (!byProp.has(f)) byProp.set(f, []); /** @type {Decl[]} */ (byProp.get(f)).push(d); }
  const out = [];
  for (const list of byProp.values()) {
    const layered = list.filter((d) => d.layer != null);
    for (const a of layered) for (const b of list) {
      if (a === b || !related(a.p, b.p) || a.v === b.v) continue;
      const [x, y] = a.n < b.n ? [a, b] : [b, a];
      if (beatsPlain(x, y) === beatsLayered(x, y)) continue;
      if (!sameElement(x.sel, y.sel, d)) continue;
      out.push(`${x.sheet} ${x.sel} {${x.p}:${x.v}${x.imp ? " !important" : ""}} vs ${y.sheet} ${y.sel} {${y.p}:${y.v}${y.imp ? " !important" : ""}}`);
    }
  }
  return [...new Set(out)];
}
