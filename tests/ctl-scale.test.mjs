// Every control's height on a desktop is on the scale, and every row's on its 8 px steps, by one census, not one
// control at a time. Controls: 24 inline · 32 standard · 40 a field or a screen's primary action. Rows: 40 one line ·
// 48 with an action or a second line · 56 a two-line list row (the coordinator's rule for the owner's "whatever is
// best", 10 Nov); 32 only in compact density. A phone keeps its own sizes (its 36 floor: tests/phone-floor.test.mjs).
//
// Grader A found the controls off the scale a few at a time (round 4: eight; on 05d76ca ten more: Decide 28, Pick
// back up 26, Open the thread 26, File · Changes 26, ⋯ More 28, Ask about this 28, Previous ask 38×36, Allow all 36).
// The census reads every class the templates put on a control (button, summary, select, the control roles, a link
// drawn as a control) and every desktop rule that sizes one. What's still off the scale is listed below, each by its
// rule, until the next sweep moves it: a new control off the scale fails here, and so does a listed one that has moved
// (the list only shrinks).
//   node tests/ctl-scale.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rules, context, decls, px } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const tokensCss = readFileSync(new URL("css/tokens.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
// the desktop's tokens: the :root block, not a phone's media query below it
const desk = tokensCss.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
const tokens = Object.fromEntries([...desk.matchAll(/(--[\w-]+):\s*(\d+(?:\.\d+)?)px/g)].map((m) => [m[1], +m[2]]));
const src = [readFileSync(new URL("index.html", ROOT), "utf8"), ...readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/${f}`, ROOT), "utf8")), ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/shells/${f}`, ROOT), "utf8"))].join("\n");
const ctl = new Set();
const add = (cls, skip) => { for (const k of cls.trim().split(/\s+/)) if (k && !skip.test(k)) ctl.add("." + k); };
for (const m of src.matchAll(/<(button|summary|select)\b([^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[2]); if (c) add(c[1], /^(is|st|k|m|t|r|e)-/); }
for (const m of src.matchAll(/<(div|span|li|a)\b([^>]*role="(button|tab|option|menuitem|menuitemradio|switch)"[^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[2]); if (c) add(c[1], /^is-/); }
// a link drawn as a control (a link in text, .lk and the rest, is words in a sentence)
for (const m of src.matchAll(/<a\b([^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[1]); if (c && !/\b(lk|lp-hh|lp-ln|cp-link)\b/.test(c[1])) add(c[1], /^is-/); }

const SCALE = new Set([24, 32, 40, 48, 56]);
const all = rules(new URL("tests/lib/x.mjs", ROOT));
const off = new Map();
for (const r of all) {
  const c = context(r, 1440);
  if (!c.active || c.cond || /data-density/.test(r.sel)) continue;
  const last = r.sel.split(/[\s>+~]+/).pop();
  if (/::?(before|after)|:(hover|active|focus)/.test(last)) continue;
  if (!(last.match(/\.[\w-]+/g) || []).some((k) => ctl.has(k)) && !/^(button|summary|select)\b/.test(last)) continue;
  for (const d of decls(r.d)) {
    if (d.p !== "height" && d.p !== "min-height") continue;
    const v = px(d.v, tokens);
    if (v == null || v === 0 || SCALE.has(v)) continue;
    off.set(`${r.f}: ${r.sel} { ${d.p} }`, v);
  }
}

// still off the scale on 10 Nov, for the next sweep (each: its rule, and what it measures). Their owners: the
// Conversation fixer's (the turn's steps, the picker, Runs, the composer's files), the Launchpad fixer's (lp-), the
// rest the integrator's.
const NOT_YET = {
  "app.css: .theme { height }": 36, "app.css: .help { height }": 28, "app.css: .then-i { min-height }": 46,
  "app.css: .pj-need { height }": 20, "app.css: .iq-route button { height }": 28, "app.css: .b-later { height }": 30,
  "app.css: .teach-tog { height }": 30, "app.css: .teach-scope button { height }": 28, "app.css: .hd-r { min-height }": 38,
  "app.css: .cw-in { height }": 34, "app.css: .ar { min-height }": 42, "app.css: .ar-fold { min-height }": 42,
  "app.css: .kr-k { height }": 34, "app.css: .switch { height }": 36, "app.css: .tb-h { min-height }": 30,
  "app.css: .tb-rh { min-height }": 28, "app.css: .tb-cf { height }": 28, "app.css: .tw-menu button { height }": 36,
  "app.css: .teach-scope.is-list button { min-height }": 36, "app.css: .rn-chip { height }": 28,
  "app.css: .rn-log { height }": 28, "app.css: .rn-back { height }": 30, "app.css: .rn-st .rn-stop { height }": 28,
  "app.css: .ar-undo button { min-height }": 36, "app.css: .syl-ln { min-height }": 44, "app.css: .syl-more { height }": 28,
  "app.css: .md-pin { height }": 28, "app.css: .map-btn { height }": 30, "app.css: .mp-x { height }": 30,
  "app.css: .mp-who { height }": 28, "app.css: .dg-tag { height }": 22, "app.css: .fl-back { height }": 30,
  "app.css: .fl-r { min-height }": 30, "app.css: .rt-seg button { height }": 30,
  "panel.css: .stg-ic { height }": 28, "panel.css: .fl-r { height }": 28, "panel.css: .fl-r { min-height }": 28,
  "panel.css: .fl-back { height }": 28, "panel.css: .ch-r { height }": 28, "panel.css: .fv-back { height }": 28,
  "panel.css: .stage .ag-r { height }": 44, "panel.css: .stage .ch-r { height }": 44,
  "diffs.css: .stage .cx-ofi { height }": 28, "diffs.css: .stage .cx-pill { height }": 28,
  "diffs.css: .xd-q .xd-send { height }": 28, "diffs.css: .xd-tx { height }": 28,
  "launchpad.css: .lp-agr { height }": 44, "launchpad.css: .lp-appr { height }": 44,
  "artifacts.css: .ar-kinds button { height }": 28, "media.css: .lbx-btn { height }": 28,
  "msgx.css: :root[data-msgx] .m-turn .turn>.tb>.tb-h { min-height }": 28,
  "fileview.css: .fchip-b { height }": 28, "fileview.css: .fchip-x { height }": 28,
};

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the census reads the controls (the graders' ten among them)", () => {
  for (const k of [".nx-link", ".ev-undo", ".dt-more", ".vw-seg", ".vw-btn", ".xd-btn", ".xd-edit", ".pn-nav", ".pn-all", ".nrow", ".prow", ".ch-row", ".hd", ".tb-h", ".lp-b", ".lbx-btn"]) assert.ok(ctl.has(k) || k === ".vw-seg", `${k} is a control`);
  assert.ok(ctl.size > 150, `${ctl.size} control classes`);
});
t("no desktop control is off the 24/32/40 scale, nor a row off its 40/48/56, but those listed for the next sweep", () => {
  const fresh = [...off].filter(([k]) => !(k in NOT_YET)).map(([k, v]) => `${k} = ${v}`);
  assert.deepEqual(fresh, [], `off the scale on a desktop:\n  ${fresh.join("\n  ")}`);
});
t("the list only shrinks: a control that has moved onto the scale leaves it", () => {
  const moved = Object.keys(NOT_YET).filter((k) => off.get(k) !== NOT_YET[k]);
  assert.deepEqual(moved, [], `listed, but no longer off the scale as listed:\n  ${moved.join("\n  ")}`);
});
t("rows from the tokens: 40 one line, 48 with an action, 56 a two-line list row; a phone's one-line rows 36, compact 32", () => {
  assert.equal(tokens["--h-row"], 40); assert.equal(tokens["--h-row-act"], 48); assert.equal(tokens["--h-row-list"], 56);
  assert.match(tokensCss, /@media \(max-width:760px\)\{:root\{--h-row:36px\}\}/);
  assert.match(readFileSync(new URL("css/shape.css", ROOT), "utf8"), /:root\[data-density="compact"\] :is\(\.main,\.sheet,\.iq-pop\)\{\s*--h-row:32px;/);
  const app = readFileSync(new URL("css/app.css", ROOT), "utf8");
  assert.match(app, /\.nrow,\.prow\{[^}]*min-height:var\(--h-row\);padding:5px 10px 5px 7px;/, "the sidebar's rows 40: 1 + 5 + its 28 px icon + 5 + 1, its left edge where it was");
  assert.match(app, /\.ch-row\{[^}]*min-height:var\(--h-row-list\);padding:9px 14px;/, "Chats' rows 56, their two lines where they were");
  assert.match(app, /\.hd\{[^}]*min-height:var\(--h-row-act\);/, "Handled 48");
  const mx = readFileSync(new URL("css/msgx.css", ROOT), "utf8");
  assert.equal((mx.match(/>\.tb-h\{width:100%;min-height:var\(--h-row\);/g) || []).length, 2, "an open tool disclosure 40 (it was 44)");
  // a phone keeps the heights it had
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8");
  assert.match(phone, /\.nrow,\.prow\{min-height:42px;padding-top:6px;padding-bottom:6px\}/);
  assert.match(phone, /\.ch-row\{min-height:58px;padding-top:10px;padding-bottom:10px\}/);
  assert.match(phone, /\.is-unfolded>\.tb-h\{min-height:44px\}/);
});
t("the composer's circles in compact density sit on its corner: no comfortable margin moves them", () => {
  assert.match(readFileSync(new URL("css/shape.css", ROOT), "utf8"), /\[data-density="compact"\] :is\(\.attach,\.send\)\{width:var\(--h-row\);height:var\(--h-row\);margin:0\}/);
});
t("a segment's buttons are 24 inside its 32 (1 + 3 of inset, their corners 6 − 4), folded to a 24 square", () => {
  for (const f of ["app.css", "panel.css"]) {
    const css = readFileSync(new URL(`css/${f}`, ROOT), "utf8");
    assert.match(css, /\.vw-seg\{[^}]*padding:3px;/, `${f}: the segment's inset`);
    assert.match(css, /\.vw-seg button\{height:var\(--h-sm\);[^}]*border-radius:calc\(var\(--r-sm\) - 4px\)/, `${f}: its buttons`);
  }
  assert.match(readFileSync(new URL("css/panel.css", ROOT), "utf8"), /\.vw-seg button:where\(:has\(svg\)\)\{width:var\(--h-sm\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
