// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { resolveValue, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

test("hovered controls raise their quieter inks except disabled controls and sidebar rows", () => {
  const controls = "button,[role=button],[role=tab],[role=option],[role=menuitem],[role=menuitemradio],summary,.rt-check";
  const excluded = ':disabled,[aria-disabled="true"],.prow,.nrow';
  const selector = ":where(" + controls + "):where(:hover:not(" + excluded + "))";
  for (const property of ["--ink-3", "--ink-4"]) {
    assert.deepEqual(valuesFor(selector, property), [resolveValue("var(--ink-2)")]);
  }
});

/** @param {string} color */
function channels(color) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  assert.match(color, /^rgba?\(/);
  return color.match(/[\d.]+/g).map(Number);
}

/** @param {number[]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("the hovered secondary ink keeps at least 4.5:1 contrast against every surface", () => {
  for (const theme of ["dark", "light"]) {
    const base = tokenValuesFor();
    const themeTokens = theme === "light" ? tokenValuesFor(':root[data-theme="light"]') : new Map();
    const tokens = new Map([...base, ...themeTokens]);
    const color = (property) => channels(substitute("var(" + property + ")", tokens));
    const fill = color("--hover-fill");
    for (const surface of ["--surface", "--canvas", "--sunken", "--float"]) {
      const painted = color(surface).map((channel, index) => channel * (1 - fill[3]) + fill[index] * fill[3]);
      const foreground = luminance(color("--ink-2"));
      const background = luminance(painted);
      const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      assert.ok(contrast >= 4.5, theme + " " + surface + " contrast " + contrast.toFixed(2));
    }
  }
});
