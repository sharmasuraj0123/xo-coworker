// A menu opened with a click lights no row until the pointer or a key picks one; opened from a key, its first item is marked.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { focusOpened } from "../js/keynav.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const item = (name, disabled = false) => ({ name, disabled, getAttribute: () => null, getClientRects: () => [1], focus() { focused = name; } });
let focused = null;
const menu = (items) => ({ attrs: {}, tabIndex: 0, hasAttribute(k) { return k in this.attrs; }, querySelectorAll: () => items, focus() { focused = "menu"; } });

t("a pointer open (a click with detail 1) focuses the menu itself: no item is focused, so none is lit", () => {
  focused = null; const m = menu([item("a"), item("b")]);
  focusOpened(m, { detail: 1 });
  assert.equal(focused, "menu"); assert.equal(m.tabIndex, -1);
});
t("a key open (Enter or Space: a click with detail 0, or no event) focuses its first usable item", () => {
  focused = null; focusOpened(menu([item("a", true), item("b")]), { detail: 0 }); assert.equal(focused, "b");
  focused = null; focusOpened(menu([item("a")])); assert.equal(focused, "a");
});
t("the sidebar's More and the thread menu open through it; More's hover moves its focus like every menu", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const side = readFileSync(new URL("../shell/rail/side.js", import.meta.url), "utf8");
  assert.match(side, /focusOpened\(pop, e\);/);
  assert.match(side, /\$\("#nv-more"\)\.addEventListener\("click", .* => \(\$\("#side-more"\)\.hidden \? SIDE\.openMore\(e\)/);
  assert.match(side, /pointerFollows\(\$\("#side-more"\)\);/);
  assert.match(app, /if \(S\.tMenu\) focusOpened\(tm\.parentElement\.querySelector\("\.tw-menu"\), e\);/);
  assert.doesNotMatch(side, /openMore\(\) \{[\s\S]{0,400}querySelector\('\[role="menuitem"\]'\)\?\.focus/);
});
t("a sidebar row in a menu is lit by focus only: its row hover stays off, so the pointer and a key never light two", () => {
  const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
  assert.match(css("app.css"), /\n\.nrow:not\(\[role=menuitem\]\):hover\{background:var\(--row-hover\)\}/);
  assert.match(css("side.css"), /:root:root \.side :is\(\.nrow,\.prow\):not\(\[role=menuitem\]\):hover\{/);
});
console.log(`\n${passed} passed`);
