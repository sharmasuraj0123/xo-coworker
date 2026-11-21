// A bar's ends follow one rule: a filled control (a button, a tinted disc) nests concentric in the corner at --nest-in;
// words or a bare glyph sit --edge-text inside the line, counted from the glyph's ink.
//   node tests/row-insets.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const app = css("app.css"), tokens = css("tokens.css"), phone = css("phone.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const m = app.match(new RegExp("\\n" + sel.replace(/[.()*+?[\]|]/g, "\\$&") + "\\{([^}]*)\\}")); assert.ok(m, sel); return m[1]; };
const pad = (body) => { const m = body.match(/;padding:0 (.+?) 0 (.+?);/); assert.ok(m, body); return { end: m[1], start: m[2] }; };

t("glyph margins are tokens, read off the pack's 24 grid", () => {
  assert.match(tokens, /--ic-ink:\.15; --ic-ink-chev:\.21; --mark-ink:calc\(2 \/ 24\);/);
});
t("the folded ask and the done line are one bar: same height, inset and button, from the same tokens", () => {
  assert.match(app, /\n:is\(\.dock-fold,\.card\.is-dock\.r-done,\.hr\)\{--nest-r:var\(--r-card\);--nest-in:calc\(\(var\(--dock-bar\) - var\(--dock-btn\)\) \/ 2 \+ 1px\);border-radius:var\(--nest-r\)\}/);
  assert.match(rule(".tp-done"), /min-height:var\(--dock-bar\)/);
  assert.match(rule(".dock-fold"), /min-height:calc\(var\(--dock-bar\) \+ 2px\)/);
  for (const b of [".tp-done-u", ".df-go"]) assert.match(rule(b), /height:var\(--dock-btn\);[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)/, b);
  assert.match(phone, /:root\{--dock-bar:var\(--h-hit\);--dock-btn:var\(--h-touch\);/);
  assert.doesNotMatch(app, /\.tp-done[^{]*\{[^}]*white-space:normal/);
  assert.match(rule(".tp-done>span:not(.tp-done-ic)"), /white-space:nowrap/, "one line, so the bar never grows past the one it replaced");
});
t("a filled control at an end nests concentric; words or a bare glyph (less its margin) sit --edge-text in", () => {
  assert.match(tokens, /--edge-text:var\(--s-3\);/);
  const cases = [
    [".tp-done", "calc(var(--nest-in) - 1px)", "calc(var(--edge-text) - var(--ic) * var(--ic-ink))"],
    [".dock-fold", "calc(var(--nest-in) - 1px)", "calc(var(--edge-text) - var(--ic-sm) * var(--mark-ink))"],
    [".hr", "calc(var(--end-in, var(--edge-text)) - 1px)", "calc(var(--start-in, var(--edge-text)) - 1px)"],
    [".ck-tog", "calc(var(--edge-text) - var(--ic) * var(--ic-ink-chev))", "var(--edge-text)"],
  ];
  for (const [sel, end, start] of cases) assert.deepEqual(pad(rule(sel)), { end, start }, sel);
});
t("the notice is one of the lines: its disc concentric in it, Open and Undo the line's own button in its corner", () => {
  assert.match(rule(".hr"), /^--ctl-in:calc\(\(var\(--dock-bar\) - var\(--ic-lg\)\) \/ 2\);[^}]*height:calc\(var\(--dock-bar\) \+ 2px\);[^}]*border-radius:var\(--nest-r\);background:var\(--glass\);border:1px solid transparent;/);
  assert.match(app, /\n\.hr:has\(>\.hr-ic\)\{--start-in:var\(--ctl-in\)\}/);
  assert.match(app, /\n\.hr:has\(>:is\(\.hr-go,\.hr-undo\)\)\{--end-in:var\(--nest-in\)\}/, "a button at the end nests in the corner; words keep the text inset");
  assert.match(rule(".hr-ic"), /width:var\(--ic-lg\);height:var\(--ic-lg\)/);
  for (const sel of [".hr-go", ".hr-undo"]) assert.match(rule(sel), /height:var\(--dock-btn\);[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)/, sel);
  assert.doesNotMatch(app, /\.hr-ev\.k-stopped\.has-undo\{padding-right/);
});
console.log(`\n${passed} passed`);
