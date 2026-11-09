// A small, browser-free model of the cascade, enough to ask: does a phone declaration still win at 390 px?
// Sheets in index.html's load order; @media evaluated for a width (a mouse, no reduced motion); @container kept as
// its own condition; selectors compared by the elements they can reach (the same selector, or one that only adds
// context before it, in either direction); specificity, then order, decide; !important wins over normal.
import { readFileSync } from "node:fs";

export const ORDER = ["base.css", "app.css", "light.css", "foundation.css", "panel.css", "diffs.css", "launchpad.css", "links.css", "artifacts.css", "dropdown.css", "media.css", "shape.css", "side.css", "msgx.css", "fileview.css", "phone.css"];

/** every style rule: {f, sel (one selector of its list), d (declarations), at: [@-preludes], n (cascade order)} */
export function rules(root) {
  const out = [];
  for (const f of ORDER) {
    const css = readFileSync(new URL(`../../css/${f}`, root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const stack = []; let i = 0, start = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === "{") {
        const pre = css.slice(start, i).trim();
        if (pre.startsWith("@")) { stack.push(pre); start = i + 1; }
        else {
          const end = css.indexOf("}", i), d = css.slice(i + 1, end);
          const n = out.length;
          for (const sel of splitList(pre)) out.push({ f, sel: norm(sel), d, at: [...stack], n });
          i = end; start = end + 1;
        }
      } else if (c === "}") { stack.pop(); start = i + 1; }
      i++;
    }
  }
  return out;
}
// split a selector list at top-level commas (not inside :is(…), :not(…), attribute brackets)
function splitList(s) { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(" || ch === "[") depth++; if (ch === ")" || ch === "]") depth--; if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }
const norm = (s) => s.replace(/\s+/g, " ").replace(/\s*([>+~])\s*/g, "$1").trim();

/** the declarations of a block: [{p, v, imp}] */
export function decls(d) {
  return d.split(";").map((x) => { const i = x.indexOf(":"); if (i < 0) return null; const p = x.slice(0, i).trim(), v = x.slice(i + 1).trim(); return p && v ? { p, v: v.replace(/\s*!important$/, ""), imp: /!important$/.test(v) } : null; }).filter(Boolean);
}

/** specificity [a, b, c] of one selector (:where() is 0; :is/:not/:has take their argument's highest) */
export function spec(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "");
  s = s.replace(/:(is|not|has|matches)\(((?:[^()]|\([^()]*\))*)\)/g, (_, k, arg) => { const best = splitList(arg).map(spec).sort(cmp).pop() || [0, 0, 0]; a += best[0]; b += best[1]; c += best[2]; return ""; });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ""; });
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, () => { c++; return ""; });
  s = s.replace(/#[\w-]+/g, () => { a++; return ""; });
  s = s.replace(/\.[\w-]+/g, () => { b++; return ""; });
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, () => { b++; return ""; });
  for (const t of s.split(/[\s>+~]+/)) if (/^[a-zA-Z][\w-]*$/.test(t)) c++;
  return [a, b, c];
}
export const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

/** does an @-prelude hold at this width? (null: not a media query, kept as its own condition) */
export function mediaHolds(pre, width) {
  if (!pre.startsWith("@media")) return null;
  const q = pre.slice(6).trim();
  return q.split(",").some((part) => part.split(/\band\b/).every((c) => {
    c = c.trim().replace(/^only\s+/, "");
    if (!c || c === "screen" || c === "all") return true;
    if (c === "print") return false;
    let m;
    if ((m = /^\(\s*max-width\s*:\s*(\d+)px\s*\)$/.exec(c))) return width <= +m[1];
    if ((m = /^\(\s*min-width\s*:\s*(\d+)px\s*\)$/.exec(c))) return width >= +m[1];
    if ((m = /^\(\s*max-height\s*:\s*(\d+)px\s*\)$/.exec(c))) return 844 <= +m[1];
    if ((m = /^\(\s*min-height\s*:\s*(\d+)px\s*\)$/.exec(c))) return 844 >= +m[1];
    if (/hover\s*:\s*none|pointer\s*:\s*coarse|any-pointer\s*:\s*coarse/.test(c)) return false;
    if (/hover\s*:\s*hover|pointer\s*:\s*fine/.test(c)) return true;
    if (/prefers-reduced-motion\s*:\s*reduce|prefers-contrast|forced-colors\s*:\s*active/.test(c)) return false;
    if (/prefers-color-scheme/.test(c)) return true; // the app's theme is its own attribute; either way
    if (/^not\s/.test(c)) return true;
    return true;
  }));
}
/** a rule's state at a width: active (every media holds), and its other conditions (container, supports) */
export function context(r, width) {
  let active = true; const cond = [];
  for (const pre of r.at) { const h = mediaHolds(pre, width); if (h === false) active = false; if (h === null && !pre.startsWith("@supports")) cond.push(pre.replace(/\s+/g, " ")); }
  return { active, cond: cond.join(" | ") };
}
/** a phone declaration: active at 390 and not at 1440 (a width media query made it the phone's) */
export const isPhone = (r) => context(r, 390).active && !context(r, 1440).active;

// properties that set one another: a shorthand and its longhands
const FAMILY = [
  ["padding", /^padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/], ["margin", /^margin(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/],
  ["inset", /^(inset(-(inline|block))?|top|right|bottom|left)$/], ["border", /^border(-(top|right|bottom|left))?(-(width|style|color))?$/],
  ["border-radius", /^border(-(top|bottom)-(left|right))?-radius$/], ["flex", /^flex(-(grow|shrink|basis))?$/], ["font", /^(font(-(size|weight|family|style|variant))?|line-height)$/],
  ["background", /^background(-(color|image|position|size|repeat|clip|origin))?$/], ["gap", /^((row|column)-)?gap$/], ["overflow", /^overflow(-[xy])?$/],
  ["grid-template", /^grid-template(-(columns|rows|areas))?$/], ["grid-column", /^grid-column(-(start|end))?$/], ["grid-row", /^grid-row(-(start|end))?$/],
  ["outline", /^outline(-(width|style|color|offset))?$/], ["transition", /^transition(-[\w-]+)?$/], ["animation", /^animation(-[\w-]+)?$/],
];
export function overlaps(p, q) {
  if (p === q) return true;
  for (const [short, re] of FAMILY) if (re.test(p) && re.test(q) && (p === short || q === short || (/^(inset|top|right|bottom|left)$/.test(p) && /^inset$/.test(q)) || (/^(inset|top|right|bottom|left)$/.test(q) && /^inset$/.test(p)))) return true;
  return false;
}
// the same elements: the same selector, or one that only adds context before it (either way round). A leading
// :root / html / body context with a theme or a body class still reaches the same elements in that state.
export function reaches(a, b) {
  if (a === b) return true;
  return a.endsWith(" " + b) || a.endsWith(">" + b) || b.endsWith(" " + a) || b.endsWith(">" + a);
}

// how a rule B reaches the elements of a rule A: "all" (the same selector, a more general one, or A under a context
// that's always there: :root, html, body, :root[data-msgx], which msgx.js always sets), "light" (A under the light
// theme), or "state" (A under a state or place: an open drawer, a docked chat, a density; a deliberate variant)
const ALWAYS = /^(?::root|html|body)(?:\[data-msgx\]|:root)*$/;
export function reach(b, a) {
  if (a === b || a.endsWith(" " + b) || a.endsWith(">" + b)) return "all";
  if (b.endsWith(" " + a) || b.endsWith(">" + a)) {
    const pre = b.slice(0, b.length - a.length - 1).trim();
    if (ALWAYS.test(pre)) return "all";
    if (/^(?::root)+\[data-theme="light"\](?::root)*$/.test(pre)) return "light";
    return "state";
  }
  return null;
}

/** every phone declaration that a non-phone rule undoes at 390, for every element it styles (or in the light
 *  theme): [{A, da, B, db, how}] */
export function lost(root) {
  const all = rules(root), out = [];
  const live = all.map((r) => ({ r, c: context(r, 390), s: spec(r.sel), phone: isPhone(r) })).filter((x) => x.c.active);
  for (const A of live.filter((x) => x.phone)) for (const da of decls(A.r.d)) {
    // the declaration that wins for A's elements, among A and every rule reaching all of them (or all in light)
    for (const how of ["all", "light"]) {
      let win = { x: A, d: da };
      for (const B of live) {
        if (B.r === A.r) continue;
        const h = reach(B.r.sel, A.r.sel);
        if (!(h === "all" || (how === "light" && h === "light"))) continue;
        if (B.c.cond && B.c.cond !== A.c.cond) continue;
        for (const db of decls(B.r.d)) {
          if (!overlaps(db.p, da.p)) continue;
          const beats = db.imp !== win.d.imp ? db.imp : cmp(B.s, win.x.s) > 0 || (cmp(B.s, win.x.s) === 0 && B.r.n > win.x.r.n);
          if (beats) win = { x: B, d: db };
        }
      }
      if (win.x !== A && !win.x.phone && win.d.v !== da.v) { out.push({ A: A.r, da, B: win.x.r, db: win.d, how }); break; }
    }
  }
  return out;
}

/** every phone declaration that doesn't win at 390: [{rule, decl, by: {rule, decl}}] */
export function losers(root) {
  const all = rules(root), out = [];
  const live = all.map((r) => ({ r, c: context(r, 390), s: spec(r.sel) })).filter((x) => x.c.active);
  for (const A of live.filter((x) => isPhone(x.r))) {
    for (const da of decls(A.r.d)) {
      for (const B of live) {
        if (B.r === A.r || !reaches(B.r.sel, A.r.sel)) continue;
        // a container-conditioned rule only meets rules under the same condition, or none
        if (B.c.cond && B.c.cond !== A.c.cond) continue;
        for (const db of decls(B.r.d)) {
          if (!overlaps(db.p, da.p)) continue;
          // B beats A: importance, then specificity, then order (B.r.n > A.r.n). Only a B that reaches every
          // element A does (the same selector, or a more general one) undoes A everywhere; a B with more context
          // undoes it where that context holds: both are reported
          const beats = db.imp !== da.imp ? db.imp : cmp(B.s, A.s) > 0 || (cmp(B.s, A.s) === 0 && B.r.n > A.r.n);
          if (beats && db.v !== da.v) out.push({ A: A.r, da, B: B.r, db, phoneB: isPhone(B.r) });
        }
      }
    }
  }
  return out;
}
