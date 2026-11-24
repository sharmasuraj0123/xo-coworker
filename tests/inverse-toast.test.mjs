// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { stylesheetRows, tokenValuesFor } from "./lib/css-snapshot.mjs";

const lightRoot = ':root[data-theme="light"]';
const inverse = lightRoot + " :is(.toast,.lbx)";
const dark = tokenValuesFor();
const light = new Map([...dark, ...tokenValuesFor(lightRoot)]);
const inverseTokens = tokenValuesFor(inverse);
const inverseTheme = new Map([...light, ...inverseTokens]);

/** @param {Map<string, string>} tokens @param {string} role */
const value = (tokens, role) => substitute("var(" + role + ")", tokens);

test("inverse toasts and lightboxes use the dark theme's values", () => {
  const required = [
    "--ink", "--ink-2", "--ink-3", "--fill-2", "--fill-4", "--line", "--hover-fill",
    "--press-fill", "--accent-rgb", "--focus",
  ];
  for (const role of required) assert.ok(inverseTokens.has(role), role);
  for (const role of inverseTokens.keys()) assert.equal(value(inverseTheme, role), value(dark, role), role);
});

const toast = stylesheetRows.filter((row) => row.property
  && /\.(?:toast|t-ic|t-m|t-undo|t-ring|t-back|xd-toast|xd-tacts|xd-tx)(?![\w-])/.test(row.context.at(-1)?.selector ?? ""));

test("toast rules use the inverse role for every themed colour", () => {
  const used = new Set(toast.flatMap((row) => [...row.value.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1])));
  assert.ok(used.has("--ink-3") && used.has("--fill-4"));
  for (const role of used) {
    if (/^--(?:ink|fill|line|hover|press|accent|err|focus|on-ink)/.test(role)
      && value(light, role) !== value(dark, role)) {
      assert.equal(value(inverseTheme, role), value(dark, role), role);
    }
  }
});

test("light-mode toast rules do not overwrite colours by hex", () => {
  const patches = toast.filter((row) => {
    const selector = row.context.at(-1)?.selector ?? "";
    return selector.includes(lightRoot) && !selector.includes("[data-flavour=")
      && selector !== inverse && selector !== lightRoot + " .toast" && /#[0-9a-f]{3,8}\b/i.test(row.value);
  });
  assert.deepEqual(patches, []);
});

/** @param {string} color */
function rgba(color) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return { rgb: [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)), alpha: 1 };
  }
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(color.replace(/\s/g, ""));
  assert.ok(match, color);
  return { rgb: match.slice(1, 4).map(Number), alpha: Number(match[4]) };
}

/** @param {{rgb: number[], alpha: number}} foreground @param {number[]} background */
const over = ({ rgb, alpha }, background) => rgb.map((channel, index) => channel * alpha + background[index] * (1 - alpha));

/** @param {number[]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const fraction = channel / 255;
    return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {number[]} a @param {number[]} b */
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("toast text, icons and focus have sufficient contrast on a light canvas", () => {
  const background = over(rgba(value(light, "--toast-bg")), rgba(value(light, "--canvas")).rgb);
  const foreground = rgba(value(inverseTheme, "--ink")).rgb;
  const meta = rgba(value(inverseTheme, "--ink-3")).rgb;
  const action = over(rgba(value(inverseTheme, "--fill-4")), background);
  const ring = over({ rgb: value(inverseTheme, "--accent-rgb").split(",").map(Number), alpha: 0.75 }, background);

  assert.ok(contrast(foreground, background) >= 4.5, "title");
  assert.ok(contrast(meta, background) >= 4.5, "secondary words");
  assert.ok(contrast(foreground, action) >= 4.5, "Undo and Tell");
  assert.ok(contrast(meta, background) >= 3, "close icon");
  assert.ok(contrast(ring, background) >= 3, "focus ring");
});
