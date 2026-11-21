// A row with a mark at its start and a control at its end keeps both the same distance from its edges: one --nest-in,
// less the glyph's own margin where the mark is a bare glyph; the end button sits concentric in the corner.
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
  assert.match(app, /\n:is\(\.dock-fold,\.card\.is-dock\.r-done\)\{--nest-r:var\(--r-lg\);--nest-in:calc\(\(var\(--dock-bar\) - var\(--dock-btn\)\) \/ 2 \+ 1px\);border-radius:var\(--nest-r\)\}/);
  assert.match(rule(".tp-done"), /min-height:var\(--dock-bar\)/);
  assert.match(rule(".dock-fold"), /min-height:calc\(var\(--dock-bar\) \+ 2px\)/);
  for (const b of [".tp-done-u", ".df-go"]) assert.match(rule(b), /height:var\(--dock-btn\);[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)/, b);
  assert.match(phone, /:root\{--dock-bar:var\(--h-hit\);--dock-btn:var\(--h-touch\)\}/);
  assert.doesNotMatch(app, /\.tp-done[^{]*\{[^}]*white-space:normal/);
  assert.match(rule(".tp-done>span:not(.tp-done-ic)"), /white-space:nowrap/, "one line, so the bar never grows past the one it replaced");
});
t("each row's start (less its glyph's margin) equals its end", () => {
  const cases = [
    [".tp-done", "calc(var(--nest-in) - 1px)", "calc(var(--nest-in) - 1px - var(--ic) * var(--ic-ink))"],
    [".dock-fold", "calc(var(--nest-in) - 1px)", "calc(var(--nest-in) - 1px - var(--ic-sm) * var(--mark-ink))"],
    [".hr", "calc(var(--end-in, var(--nest-in)) - 1px - var(--trail-ink, 0px))", "calc(var(--start-in, var(--nest-in)) - 1px)"],
    [".ck-tog", "calc(var(--s-3) - var(--ic) * var(--ic-ink-chev))", "var(--s-3)"],
  ];
  for (const [sel, end, start] of cases) assert.deepEqual(pad(rule(sel)), { end, start }, sel);
});
t("the notice: a disc sits concentric in its pill; an arrow's ink counts, an Undo nests in the corner", () => {
  assert.match(rule(".hr"), /^--nest-r:calc\(var\(--h-ctl\) \/ 2\);--nest-in:calc\(var\(--s-3\) \+ 1px\);--ctl-in:calc\(\(var\(--h-ctl\) - var\(--ic-lg\)\) \/ 2\);/);
  assert.match(app, /\n\.hr:has\(>\.hr-ic\)\{--start-in:var\(--ctl-in\)\}/);
  assert.match(app, /\n\.hr:has\(>\.hr-undo\)\{--end-in:var\(--ctl-in\)\}/, "only a filled end takes the concentric inset; words keep the text inset");
  assert.match(app, /\n\.hr:has\(>\.hr-go\)\{--trail-ink:calc\(var\(--ic-sm\) \* var\(--ic-ink\)\)\}/);
  assert.match(rule(".hr-ic"), /width:var\(--ic-lg\);height:var\(--ic-lg\)/);
  assert.match(rule(".hr-undo"), /^--nest-in:var\(--ctl-in\);[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)/);
  assert.doesNotMatch(app, /\.hr-ev\.k-stopped\.has-undo\{padding-right/);
});
console.log(`\n${passed} passed`);
