// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules } from "./lib/css-snapshot.mjs";

const rules = publishedRules();

/** @param {string} menu @param {string} item */
function paintedStates(menu, item) {
  const states = new Set();
  for (const { sel, declarations } of rules) {
    const menuIndex = sel.indexOf(menu);
    if (menuIndex === -1) continue;
    const itemIndex = sel.indexOf(item, menuIndex + menu.length);
    if (itemIndex === -1 || !declarations.some(({ p }) => p === "background" || p.startsWith("background-"))) continue;
    const tail = sel.slice(itemIndex + item.length);
    for (const [, state] of tail.matchAll(/:(hover|focus-visible|focus)(?![\w-])/g)) states.add(state);
  }
  return states;
}

for (const [name, menu, item] of [
  ["file, folder and thread menus", "[role=menu]", "[role=menuitem]"],
  ["Launchpad’s menu", ".lp-mn", "button"],
  ["long-press menu", ".lp-menu", "button"],
]) {
  test(`${name} paint the focused item after moving from mouse to keyboard`, () => {
    const states = paintedStates(menu, item);
    assert.ok(states.has("focus") || states.has("focus-visible"), "A keyboard-focused item has a fill");
    assert.ok(!states.has("hover"), "The item under the pointer has no separate fill");
  });
  test(`${name} paint the mouse-focused item`, () => {
    assert.ok(paintedStates(menu, item).has("focus"), "Mouse focus also paints the item");
  });
}
