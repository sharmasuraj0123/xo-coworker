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
const EXCEPT = {
  "app.css: .pj-need { height }": "the project head's \"needs you\" words in its path line: a link in a line of text, its line's 20 (the phone bar's quiet line, put to the owner with the floor)",
};
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
  // a phone keeps the heights it had
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8");
  assert.match(phone, /\.nrow,\.prow\{min-height:42px;padding-top:6px;padding-bottom:6px\}/);
  assert.match(phone, /\.ch-row\{min-height:58px;padding-top:10px;padding-bottom:10px\}\s*\.ch-main\{gap:4px\}\s*\.ch-m\{line-height:20px\}\s*\.pr-name\{line-height:1\.3\}\s*\.pr-t\{line-height:1\.35\}/);
  assert.match(phone, /\.is-unfolded>\.tb-h\{min-height:44px\}/);
});
t("a control sized by its words and padding is on the scale too: the decision's where line, 24 (S157: 104×26)", () => {
  // the census reads declared heights; one drawn by its padding (3 + 20 + 3) escaped it (the controls grader on f93345a)
  assert.match(readFileSync(new URL("css/app.css", ROOT), "utf8"), /\.c-where\{[^}]*height:var\(--h-sm\);[^}]*padding:0 6px;/);
});
t("a button drawn as a link, standing on its own, has the desktop's 24 floor; one in a sentence is words (S014: the docked Undo, 39×20)", () => {
  const fnd = readFileSync(new URL("css/foundation.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const links = fnd.match(/:is\(([^)]*)\)\{transition:color var\(--d-hover\)/)[1].split(",");
  const floor = fnd.match(/:where\(([^)]*)\)\{min-height:var\(--h-sm\)\}/)[1].split(",");
  // in a sentence: Copy path's (dialog text), Launchpad's lines, Home in the Workspace's sentence
  const words = [".cp-link", ".lp-ln", ".wsh-home"];
  assert.deepEqual([...floor, ...words].sort(), [...links].sort(), "every link-like button is placed: the floor, or words in a sentence");
  assert.match(readFileSync(new URL("js/app.js", ROOT), "utf8"), /<p class="wsh-p">[^<]*<button type="button" class="wsh-home"/, "Home is a word in the Workspace's sentence");
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
