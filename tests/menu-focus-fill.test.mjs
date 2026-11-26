// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { resolveValue, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

test("focused menu items use the shared focus fill", () => {
  const item = "[role=menu] :is([role=menuitem],[role=menuitemradio]):focus";
  const fill = resolveValue("var(--menu-focus)");
  assert.deepEqual(valuesFor(item, "background"), [fill]);
  const menuFocus = (selector) => /menu.*:focus/.test(selector);
  const fills = valuesFor(menuFocus, "background");
  assert.ok(fills.length >= 2);
  for (const background of fills) assert.deepEqual(background, fill);
});

/** @param {string} hex */
function rgb(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

test("menu focus differs from the float by at least 45 RGB-sum in each base theme", () => {
  const dark = tokenValuesFor();
  const light = tokenValuesFor(':root[data-theme="light"]');
  const inverse = tokenValuesFor(':root[data-theme="light"] .lbx');
  for (const overrides of [dark, light, inverse]) {
    assert.ok(overrides.has("--menu-focus"));
    const theme = new Map([...dark, ...overrides]);
    const background = rgb(substitute("var(--float)", theme));
    const focus = rgb(substitute("var(--menu-focus)", theme));
    const distance = background.reduce((sum, channel, index) => sum + Math.abs(channel - focus[index]), 0);
    assert.ok(distance >= 45, String(distance));
  }
});
