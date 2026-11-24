// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

test("menu rows use the 14/20 interface type", () => {
  assert.equal(resolveValue("var(--fs-ui)/var(--lh-ui)"), "14px/20px");
  const menus = [
    ".at-list li", ".iq-h h2", ".lp-menu button", ".dd-row", ".lp-mn :is(button,a)",
    ".vw-menu :is([role=menuitem],[role=menuitemradio])", ".fl-menu button",
  ];
  for (const selector of menus) {
    const fonts = valuesFor(selector, "font");
    assert.ok(fonts.length > 0, selector);
    for (const font of fonts.flat()) assert.match(font, /\b14px\/20px\b/, selector);
    assert.deepEqual(valuesFor(selector, "font-size"), [], selector);
    assert.deepEqual(valuesFor(selector, "line-height"), [], selector);
  }
  assert.deepEqual(valuesFor(".tw-menu button", "font-size"), ["14px"]);
  assert.deepEqual(valuesFor(".tw-menu button", "line-height"), ["20px"]);
});

test("model picker rows use the 12/16 meta type", () => {
  for (const selector of [".iq-n", ".iq-more"]) {
    const fonts = valuesFor(selector, "font");
    assert.ok(fonts.length > 0, selector);
    for (const font of fonts.flat()) assert.match(font, /\b12px\/16px\b/, selector);
    assert.deepEqual(valuesFor(selector, "font-size"), [], selector);
    assert.deepEqual(valuesFor(selector, "line-height"), [], selector);
  }
});
