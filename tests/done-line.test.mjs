// The line left after a decision ("Allowed. It's back at work.") is the notice line's pill, centred where the card was.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";

const css = sheet(new URL("../css/app.css", import.meta.url));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("the done line's frame draws nothing of its own and centres the pill", () => {
  assert.match(css, /\n\.card\.is-dock\.r-done\{align-items:center;background:none;overflow:visible\}/);
  assert.ok(css.indexOf(".card.is-dock.r-done{") > css.indexOf(".card.is-dock{"), "comes after the dock card's fill");
  assert.doesNotMatch(css, /\.tp-done/);
});
t("the pill is glass tinted by its state, like every notice", () => {
  assert.match(css, /\n:is\(\.dock-fold,\.hr\)\{--glass:color-mix\(in srgb,var\(--state,transparent\) 12%,/);
  assert.match(css, /\n\.hr\{[^}]*height:calc\(var\(--note-h\) \+ 2px\);[^}]*border-radius:var\(--r-pill\)/);
});
console.log(`\n${passed} passed`);
