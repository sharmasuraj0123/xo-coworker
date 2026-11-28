// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { tokenValuesFor } from "./lib/css-snapshot.mjs";

const lightRoot = ':root[data-theme="light"]';
const inverse = lightRoot + " .lbx";
const dark = tokenValuesFor();
const light = new Map([...dark, ...tokenValuesFor(lightRoot)]);
const inverseTokens = tokenValuesFor(inverse);
const inverseTheme = new Map([...light, ...inverseTokens]);

/** @param {Map<string, string>} tokens @param {string} role */
const value = (tokens, role) => substitute("var(" + role + ")", tokens);

test("the lightbox uses the dark theme's values", () => {
  const required = [
    "--ink", "--ink-2", "--ink-3", "--fill-2", "--fill-4", "--line", "--hover-fill",
    "--press-fill", "--accent-rgb", "--focus",
  ];
  for (const role of required) assert.ok(inverseTokens.has(role), role);
  for (const role of inverseTokens.keys()) assert.equal(value(inverseTheme, role), value(dark, role), role);
});
