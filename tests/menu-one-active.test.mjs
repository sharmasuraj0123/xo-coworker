// A menu shows one active item, whichever hand moved it: the mouse onto Copy path, then ↓ to the next item, must
// leave one painted item, the one Enter would choose. Offline: each menu's own highlight rule (the stylesheets' text)
// is matched against the state that sequence leaves (the pointer still over Copy path, focus on the next item, as
// keynav.js and the menus' own arrows leave it). Astra on e1f8666: :hover and :focus-visible painted alike, so two
// items could look active again. No browser.
//   node tests/menu-one-active.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SHEETS = ["app.css", "diffs.css", "panel.css", "launchpad.css"];
const css = SHEETS.map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), d: m[2] }));
/** the states a selector for an item of this menu paints: hover, focus (any), focus-visible */
function paints(menu, item) {
  const states = new Set();
  for (const r of rules) {
    if (!/background/.test(r.d)) continue;
    for (const one of r.sel.split(/,(?![^(]*\))/).map((s) => s.trim())) {
      if (!one.includes(menu) || !one.includes(item)) continue;
      const tail = one.slice(one.indexOf(item) + item.length);
      if (/:hover/.test(tail)) states.add("hover");
      if (/:focus-visible/.test(tail)) states.add("focus-visible");
      else if (/:focus\b/.test(tail)) states.add("focus");
      if (/:is\([^)]*:hover/.test(tail)) states.add("hover");
    }
  }
  return states;
}
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

for (const [name, menu, item] of [["the file's More", ".vw-menu", "[role=menuitem]"], ["Files' folder menu", ".fl-menu", "button"], ["the thread menu", ".tw-menu", "button"], ["Launchpad's ⋯", ".lp-mn", "button"], ["the long-press menu", ".lp-menu", "button"]]) {
  t(`${name}: mouse onto an item, then ↓: one painted item (the focused one)`, () => {
    const p = paints(menu, item);
    assert.ok(p.size, `${menu} ${item} has a highlight`);
    // the state after mouse → ↓: the pointer is over item 0 (hover), focus is on item 1, moved by a key (focus-visible)
    const painted = [p.has("hover") ? "item 0 (under the pointer)" : null, p.has("focus") || p.has("focus-visible") ? "item 1 (focused)" : null].filter(Boolean);
    assert.deepEqual(painted, ["item 1 (focused)"], `painted: ${painted.join(" and ")} (its highlight paints ${[...p].join(", ")})`);
  });
  t(`${name}: what the mouse points at is painted (by focus, which the pointer moves): the highlight is :focus, not only :focus-visible`, () => {
    const p = paints(menu, item);
    assert.ok(p.has("focus"), `its highlight paints ${[...p].join(", ")}: a mouse-moved focus (not focus-visible) must show`);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
