// The line left after a decision ("Done. It's back at work.") is one row like the checklist bar: --h-ctl, not a padded slab.
//   node tests/done-line.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("the done line is a 32 px row with the shared padding, its disc and mark on the icon scale", () => {
  assert.match(css, /\n\.tp-done\{display:flex;align-items:center;gap:var\(--gap-icon\);min-height:var\(--h-ctl\);margin:0;padding:0 var\(--s-2\) 0 var\(--s-3\);/);
  assert.match(css, /\n\.tp-done-ic\{flex:none;display:grid;place-items:center;width:var\(--ic\);height:var\(--ic\);/);
  assert.match(css, /\n\.tp-done-ic svg\{width:var\(--ic-xs\);height:var\(--ic-xs\)\}/);
  assert.match(css, /\n\.ck-tog\{[^}]*height:var\(--h-ctl\)/);
});
t("the done line's frame has the checklist bar's corner, not the dock card's", () => {
  assert.match(css, /\n\.card\.is-dock\.r-done\{border-radius:var\(--r-lg\)\}/);
  assert.match(css, /\n\.ckbar\{border-radius:var\(--r-lg\)/);
  assert.ok(css.indexOf(".card.is-dock.r-done{") > css.indexOf(".card.is-dock{"), "comes after the dock card's radius");
});
console.log(`\n${passed} passed`);
