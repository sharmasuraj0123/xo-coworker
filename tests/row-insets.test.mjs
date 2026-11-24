import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sheet } from "./lib/cascade.mjs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const app = sheet(new URL("../css/app.css", import.meta.url)), tokens = css("../core/ui/tokens.css"), phone = sheet(new URL("../css/phone.css", import.meta.url));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const m = app.match(new RegExp("\\n" + sel.replace(/[.()*+?[\]|]/g, "\\$&") + "\\{([^}]*)\\}")); assert.ok(m, sel); return m[1]; };
const pad = (body) => { const m = body.match(/;padding:0 (.+?) 0 (.+?);/); assert.ok(m, body); return { end: m[1], start: m[2] }; };

t("glyph margins are tokens, read off the pack's 24 grid", () => {
  assert.match(tokens, /--ic-ink:\.15; --ic-ink-chev:\.21; --mark-ink:calc\(2 \/ 24\);/);
});
t("the folded ask and the done line are one bar: same height, inset and button, from the same tokens", () => {
  assert.match(app, /\n:is\(\.dock-fold,\.card\.is-dock\.r-done\)\{--nest-r:var\(--r-card\);--nest-in:calc\(\(var\(--dock-bar\) - var\(--dock-btn\)\) \/ 2 \+ 1px\);border-radius:var\(--nest-r\)\}/);
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
    [".hr", "calc(var(--edge-text) - 1px)", "calc(var(--edge-text) - 1px)"],
    [".ck-tog", "calc(var(--edge-text) - var(--ic) * var(--ic-ink-chev))", "var(--edge-text)"],
  ];
  for (const [sel, end, start] of cases) assert.deepEqual(pad(rule(sel)), { end, start }, sel);
});
t("the notice is a pill a control tall: its icon bare, Open and Undo pills nested --note-in from its end", () => {
  assert.match(tokens, /--note-h:var\(--h-ctl\); --note-btn:var\(--h-sm\);/);
  assert.match(phone, /:root\{[^}]*--note-h:var\(--h-touch\);/);
  assert.match(rule(".hr"), /^--note-in:calc\(\(var\(--note-h\) - var\(--note-btn\)\) \/ 2\);[^}]*height:calc\(var\(--note-h\) \+ 2px\);[^}]*border-radius:var\(--r-pill\);background:var\(--glass\);border:1px solid transparent;/);
  assert.match(app, /\n\.hr:has\(>:is\(\.hr-go,\.hr-undo\)\)\{padding-right:calc\(var\(--note-in\) - 1px\)\}/, "a button at the end nests by the same inset top and side");
  assert.doesNotMatch(rule(".hr-ic"), /background|border-radius|width/, "no disc");
  for (const sel of [".hr-go", ".hr-undo"]) assert.match(rule(sel), /height:var\(--note-btn\);[^}]*border-radius:var\(--r-pill\)/, sel);
  assert.match(app, /\.hr:has\(>\.hr-undo\)\{--note-btn:var\(--h-touch\);--note-h:calc\(var\(--note-btn\) \+ 2 \* var\(--s-1\)\)\}/, "on a phone Undo keeps a finger's height");
  assert.doesNotMatch(app, /\.hr(?:-ev)?[^{]*\{[^}]*(?:min-height:38px|padding:5px)/, "no fixed sizes");
});
t("a long notice ellipses its words, never its buttons: the subline gives way first, then the title", () => {
  assert.match(rule(".hr"), /max-width:100%;/);
  assert.match(rule(".hr-t"), /^min-width:0;overflow:hidden;text-overflow:ellipsis;/);
  assert.match(rule(".hr-s"), /^flex-shrink:1000;[^}]*overflow:hidden;text-overflow:ellipsis/);
  assert.doesNotMatch(app, /\.hr-t\{[^}]*flex:none/, "a title that can't shrink pushes Open out of the pill");
  for (const sel of [".hr-go", ".hr-undo"]) assert.match(rule(sel), /^flex:none;/, sel);
  assert.match(app, /\n  \.hr-ev\.k-stopped \.hr-t\{flex:1 1 0\}/, "on a phone a stopped title keeps the icon's line instead of wrapping under it");
});
console.log(`\n${passed} passed`);
