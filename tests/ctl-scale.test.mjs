// Every control's height on a desktop is on the scale, and every row's on its 8 px steps, by one census, not one
// control at a time. Controls: 24 inline · 32 standard · 40 a field or a screen's primary action. Rows: 40 one line ·
// 48 with an action or a second line · 56 a two-line list row (the coordinator's rule for the owner's "whatever is
// best", 10 Nov); 32 only in compact density. A phone keeps its own sizes (its 36 floor: tests/phone-floor.test.mjs).
//
// Grader A found the controls off the scale a few at a time (round 4: eight; on 05d76ca ten more: Decide 28, Pick
// back up 26, Open the thread 26, File · Changes 26, ⋯ More 28, Ask about this 28, Previous ask 38×36, Allow all 36).
// The census reads every class the templates put on a control (button, summary, select, the control roles, a link
// drawn as a control) and every desktop rule that sizes one; it found 54 more off the scale, all moved in one sweep
// (buttons 28, 30, 34 and 36 to 32; a tag 22 to 24; rows 38, 42 and 44 to 40, or to 48 with a second line). What's
// left is a written exception, or in another fixer's file and listed for it: a new control off the scale fails here,
// and so does a listed one that has moved (the lists only shrink).
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

// written exceptions, each with its reason
// (the project head's "needs you" was one, as a link in a line of text; it leads that line as a control on its own,
// and is 24 now: the create-project grader on 24be023, S005)
const EXCEPT = {};
// still off the scale, in a file another fixer owns (fix-assignments.md): none. Launchpad's agent-thread and app rows
// (44) went to 48 in its fixer's c14fc08; the folded tool pill (28) to 32 in the Conversation fixer's 89f486a. A new
// entry here needs its owner and the coordinator's word.
const NOT_YET = {};

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the census reads the controls (the graders' ten among them)", () => {
  for (const k of [".nx-link", ".ev-undo", ".dt-more", ".vw-seg", ".vw-btn", ".xd-btn", ".xd-edit", ".pn-nav", ".pn-all", ".nrow", ".prow", ".ch-row", ".hd", ".tb-h", ".lp-b", ".lbx-btn"]) assert.ok(ctl.has(k) || k === ".vw-seg", `${k} is a control`);
  assert.ok(ctl.size > 150, `${ctl.size} control classes`);
});
t("no desktop control is off the 24/32/40 scale, nor a row off its 40/48/56, but those listed for the next sweep", () => {
  const fresh = [...off].filter(([k]) => !(k in NOT_YET) && !(k in EXCEPT)).map(([k, v]) => `${k} = ${v}`);
  assert.deepEqual(fresh, [], `off the scale on a desktop:\n  ${fresh.join("\n  ")}`);
});
t("the lists only shrink: a control that has moved onto the scale leaves them", () => {
  const moved = [...Object.keys(NOT_YET).filter((k) => off.get(k) !== NOT_YET[k]), ...Object.keys(EXCEPT).filter((k) => !off.has(k))];
  assert.deepEqual(moved, [], `listed, but no longer off the scale as listed:\n  ${moved.join("\n  ")}`);
});
t("rows from the tokens: 40 one line, 48 with an action, 56 a two-line list row; a phone's one-line rows 36, compact 32", () => {
  assert.equal(tokens["--h-row"], 40); assert.equal(tokens["--h-row-act"], 48); assert.equal(tokens["--h-row-list"], 56);
  assert.match(tokensCss, /@media \(max-width:760px\)\{:root\{--h-row:36px\}\}/);
  assert.match(readFileSync(new URL("css/shape.css", ROOT), "utf8"), /:root\[data-density="compact"\] :is\(\.main,\.sheet,\.iq-pop\)\{\s*--h-row:32px;/);
  // and its controls on the scale: 24, not 28 (C106, the Compact switch 46×28; the owner, 11 Nov 05:42Z)
  assert.match(readFileSync(new URL("css/shape.css", ROOT), "utf8"), /:root\[data-density="compact"\] :is\(\.main,\.sheet,\.iq-pop\)\{\s*--h-row:32px; --h-ctl:var\(--h-sm\);/);
  const app = readFileSync(new URL("css/app.css", ROOT), "utf8");
  assert.match(app, /\.nrow,\.prow\{[^}]*min-height:var\(--h-row\);padding:5px 10px 5px 7px;/, "the sidebar's rows 40: 1 + 5 + its 28 px icon + 5 + 1, its left edge where it was");
  // the rows as drawn, not only their floor: the words inside them fill the step exactly (the row measurement on
  // f93345a: Chats' rows were 64, their two lines 20 + 4 + 20 over a 56 floor; a project's two lines 49.1, 18.2 + 2 +
  // 16.9 at line heights of 1.3 and 1.35)
  assert.match(app, /\.ch-row\{[^}]*min-height:var\(--h-row-list\);padding:8px 14px;/, "Chats' rows 56: 1 + 8 + their two lines + 8 + 1");
  assert.match(app, /\.ch-main\{[^}]*gap:2px\}/); assert.match(app, /\.ch-t\{font:500 var\(--fs-md\)\/20px/); assert.match(app, /\.ch-m\{font-size:var\(--fs-sm\);line-height:16px;/, "20 + 2 + 16 = 38");
  assert.match(app, /\.pr-main\{[^}]*gap:2px\}/); assert.match(app, /\.pr-name\{[^}]*font:550 var\(--fs-md\)\/18px/); assert.match(app, /\.pr-t\{[^}]*line-height:16px;/, "a project's row with its second line 48: 1 + 5 + 18 + 2 + 16 + 5 + 1");
  assert.match(app, /\.hd\{[^}]*min-height:var\(--h-row-act\);/, "Handled 48");
  const mx = readFileSync(new URL("css/msgx.css", ROOT), "utf8");
  assert.equal((mx.match(/>\.tb-h\{width:100%;min-height:var\(--h-row\);/g) || []).length, 2, "an open tool disclosure 40 (it was 44)");
  // a phone's rows on the steps (the owner, 11 Nov 05:42Z)
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8");
  assert.match(phone, /\.nrow,\.prow\{min-height:40px;padding-top:5px;padding-bottom:5px\}/);
  // Chats' rows are 56 on a phone too: no phone rule changes them (C048: their phone 58 floor drew 66)
  assert.doesNotMatch(phone.replace(/\/\*[\s\S]*?\*\//g, ""), /\.ch-(row|main|m)\{/, "a phone keeps Chats' rows as a desktop draws them, 56");
  assert.match(phone, /\.pr-name\{line-height:1\.3\}\s*\.pr-t\{line-height:1\.35\}/);
  assert.match(phone, /\.is-unfolded>\.tb-h\{min-height:48px\}/);
});
t("a phone's rows are on its steps (36 one line, 40, 48, 56), but those listed for the coordinator's ruling: the lists only shrink", () => {
  // the row census read a desktop only, and a phone's rows were kept as they were by a rule of their own (30bd6d0):
  // C048, Chats' rows 66 on a phone, wasn't seen. Now a phone's row floors are read too
  const PHONE_STEPS = new Set([36, 40, 48, 56]);
  // none kept: the six a phone had kept from before the 8 px steps moved onto them (the owner, 11 Nov 05:42Z)
  const KEPT = {};
  const phoneCss = readFileSync(new URL("css/phone.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rows = /\.(nrow|prow|ch-row|hd-r|ar|ar-fold|ar-undo|syl-ln|ag-r|ch-r|tb-h|b-opt|set-row|iq-row|fl-r|cx-r|kr)\b/;
  const off = [];
  for (const m of phoneCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().split("\n").pop().trim(); if (!rows.test(sel)) continue;
    for (const [, p, v] of m[2].matchAll(/(?:^|;)\s*(min-height|height):(\d+)px/g)) if (!PHONE_STEPS.has(+v) && +v >= 36) off.push([`phone.css: ${sel} { ${p} }`, +v]);
  }
  const fresh = off.filter(([k, v]) => KEPT[k] !== v).map(([k, v]) => `${k} = ${v}`);
  assert.deepEqual(fresh, [], `a phone's rows off its steps:\n  ${fresh.join("\n  ")}`);
  const moved = Object.keys(KEPT).filter((k) => !off.some(([x, v]) => x === k && v === KEPT[k]));
  assert.deepEqual(moved, [], "listed, but no longer kept as listed: take it off");
});
t("a control sized by its words and padding is on the scale too: the decision's where line, 24 (S157: 104×26)", () => {
  // the census reads declared heights; one drawn by its padding (3 + 20 + 3) escaped it (the controls grader on f93345a)
  assert.match(readFileSync(new URL("css/app.css", ROOT), "utf8"), /\.c-where\{[^}]*height:var\(--h-sm\);[^}]*padding:0 6px;/);
});
t("a row-type control's one line fits its row: border, padding and line no taller than its floor, so only words that wrap grow it", () => {
  // a row's floor (min-height 40/48/56) hides a height its padding and line make: one 2 px over made Home's answers
  // 42 (S025) and an item's answers with a description 65 (S052). Read from the rules: a control whose min-height is a
  // row step, with its padding and its line height declared, and a border wherever its classes draw one
  const steps = { "var(--h-lg)": 40, "var(--h-row)": 40, "var(--h-row-act)": 48, "var(--h-row-list)": 56, "40px": 40, "48px": 48, "56px": 56 };
  // a class drawn with others (.b-opt is always .b b-opt): a border any of them draws counts
  const co = new Map();
  for (const m of src.matchAll(/class="([^"$]*)/g)) { const list = m[1].trim().split(/\s+/).filter(Boolean).map((k) => "." + k); for (const k of list) co.set(k, new Set([...(co.get(k) || []), ...list])); }
  const withCo = (ks) => [...new Set(ks.flatMap((k) => [k, ...(co.get(k) || [])]))];
  const bordered = (ks0) => { const ks = withCo(ks0); return all.some((r) => context(r, 1440).active && ks.some((k) => new RegExp(`\\${k}(?![\\w-])`).test(r.sel.split(/[\\s>+~]+/).pop())) && decls(r.d).some((d) => /^border(-width)?$/.test(d.p) && /1px/.test(d.v))); };
  const over = [];
  for (const r of all) {
    const c = context(r, 1440);
    if (!c.active || c.cond || /data-density/.test(r.sel)) continue;
    const last = r.sel.split(/[\s>+~]+/).pop(), ks = last.match(/\.[\w-]+/g) || [];
    if (!ks.some((k) => ctl.has(k)) || /:/.test(last)) continue;
    const ds = decls(r.d), mh = ds.find((d) => d.p === "min-height"), pad = ds.find((d) => d.p === "padding");
    const lh = ds.find((d) => d.p === "line-height") || ds.find((d) => d.p === "font" && /\/\d+px/.test(d.v));
    if (!mh || !(mh.v in steps) || !pad || !lh || ds.some((d) => d.p === "height" && d.v !== "auto")) continue;
    const pv = pad.v.split(/\s+/).map((x) => (/^(\d+)px$/.test(x) ? +x.slice(0, -2) : x === "0" ? 0 : NaN));
    const line = +(/(\d+)px/.exec(lh.p === "font" ? lh.v.split("/")[1] : lh.v) || [])[1];
    const drawn = (bordered(ks) ? 2 : 0) + pv[0] + (pv[2] ?? pv[0]) + line;
    if (Number.isFinite(drawn) && drawn > steps[mh.v]) over.push(`${r.f}: ${r.sel} = ${drawn} over its ${steps[mh.v]}`);
  }
  assert.deepEqual(over, [], "rows whose one line is taller than their floor");
});
t("a button's label sits on one line: the meta line's buttons never wrap or shrink (S045: Stop the turn on a phone)", () => {
  // the browser sweep (harness.cjs ringClips) checks every one-line control in view for a label on two lines
  assert.match(readFileSync(new URL("css/app.css", ROOT), "utf8"), /\.meta-btn\{flex:none;white-space:nowrap;display:inline-flex;/);
});
t("an answer is a row: one line 40, with its description line 56 (S025, S052)", () => {
  const app = readFileSync(new URL("css/app.css", ROOT), "utf8");
  assert.match(app, /\.b-opt\{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:0;min-height:var\(--h-lg\);padding:7px 14px;[^}]*line-height:24px;/, "1 + 7 + 24 + 7 + 1 = 40");
  assert.match(app, /\.o-l\{font:500 var\(--fs-lg\)\/24px/);
  assert.match(app, /\.o-d\{display:block;margin-top:0;font:400 var\(--fs-sm\)\/16px/, "+ 16 = 56, no gap between the lines");
});
t("a button drawn as a link, standing on its own, has the desktop's 24 floor; one in a sentence is words (S014: the docked Undo, 39×20)", () => {
  const fnd = readFileSync(new URL("css/foundation.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const links = fnd.match(/:is\(([^)]*)\)\{transition:color var\(--d-hover\)/)[1].split(",");
  const floor = fnd.match(/:where\(([^)]*)\)\{min-height:var\(--h-sm\)\}/)[1].split(",");
  // in a sentence: Copy path's (dialog text), Launchpad's lines, Home in the Workspace's sentence; and the @ line's
  // "change", a word (a span) inside that line's own button
  const words = [".cp-link", ".lp-ln", ".wsh-home", ".tg-ch"];
  assert.deepEqual([...floor, ...words].sort(), [...links].sort(), "every link-like button is placed: the floor, or words in a sentence");
  assert.match(readFileSync(new URL("js/app.js", ROOT), "utf8"), /<p class="wsh-p">[^<]*<button type="button" class="wsh-home"/, "Home is a word in the Workspace's sentence");
  assert.match(readFileSync(new URL("js/chats.js", ROOT), "utf8"), /<span class="tg-ch">/, "the @ line's change is a word in its button");
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
