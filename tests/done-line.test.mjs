// The line left after a decision ("Done. It's back at work.") is one calm row like the checklist bar: --h-ctl, tinted, no rim.
//   node tests/done-line.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("the done line is a 32 px row: the pack's bare check at --ic, Undo a quiet 24 px button nested in its corner", () => {
  assert.match(css, /\n\.tp-done\{display:flex;align-items:center;gap:var\(--gap-icon\);min-height:var\(--dock-bar\);margin:0;padding:0 calc\(var\(--nest-in\) - 1px\) 0 calc\(var\(--nest-in\) - 1px - var\(--ic\) \* var\(--ic-ink\)\);/);
  assert.match(css, /\n\.tp-done-ic\{flex:none;display:grid;place-items:center;width:var\(--ic\);height:var\(--ic\);color:var\(--accent\)\}/);
  assert.match(css, /\n\.tp-done-ic svg\{width:var\(--ic\);height:var\(--ic\)\}/);
  assert.match(css, /\n\.tp-done-u\{flex:none;height:var\(--dock-btn\);padding:0 var\(--s-3\);border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\);background:var\(--btn-fill\);/);
  assert.doesNotMatch(css, /\.tp-done-u\{[^}]*text-decoration:underline/);
  assert.match(css, /\n\.ck-tog\{[^}]*height:var\(--h-ctl\)/);
});
t("the done line's frame has the checklist bar's corner, not the dock card's", () => {
  assert.match(css, /\n:is\(\.dock-fold,\.card\.is-dock\.r-done\)\{--nest-r:var\(--r-lg\);[^}]*border-radius:var\(--nest-r\)\}/);
  assert.match(css, /\n\.ckbar\{border-radius:var\(--r-lg\)/);
  assert.ok(css.indexOf(".card.is-dock.r-done{") > css.indexOf(".card.is-dock{"), "comes after the dock card's radius");
});
t("the done line has no rim: the done state is the ok tint over the surface, a step back the gray fill", () => {
  assert.match(css, /\n\.card\.is-dock\.r-done\{border-color:transparent;background:linear-gradient\(var\(--ok-fill\),var\(--ok-fill\)\),var\(--surface\)\}/);
  assert.match(css, /\n\.card\.is-dock\.r-done:has\(\.is-back\)\{background:linear-gradient\(var\(--btn-fill\),var\(--btn-fill\)\),var\(--surface\)\}/);
});
console.log(`\n${passed} passed`);
