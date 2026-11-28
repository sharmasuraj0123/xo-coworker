// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("text fields use the accent caret and suppress their outline", () => {
  const excluded = ["checkbox", "radio", "range", "button", "submit", "reset", "file", "color", "image"]
    .map((type) => "[type=" + type + "]").join(",");
  const focused = ":is(input:not(" + excluded + "),textarea,[contenteditable]):focus-visible";
  assert.deepEqual(valuesFor(focused, "outline"), ["none"]);
  assert.deepEqual(valuesFor(":is(input,textarea,[contenteditable])", "caret-color"), [resolveValue("var(--accent)")]);
});

test("bordered fields draw an accent edge and soft glow", () => {
  const fields = ".field input,.field textarea,.lp-in,.shd-in,.c-note textarea,.tw-in,.c-q-in,.c-name-in";
  const focused = ":is(" + fields + "):focus";
  assert.deepEqual(valuesFor(focused, "border-color"), [resolveValue("var(--field-line-focus)")]);
  assert.deepEqual(valuesFor(focused, "box-shadow"), [resolveValue("0 0 0 3px var(--focus-halo)")]);

  for (const [token, alpha] of [["--field-line-focus", ".8"], ["--focus-halo", ".2"]]) {
    const palette = stylesheetRows.filter((row) => row.property === token && row.context[0]?.params === "tokens");
    assert.equal(palette.length, 2, token);
    for (const row of palette) assert.equal(row.value, "rgba(var(--accent-rgb)," + alpha + ")");
  }
});

test("focus rules keep field outlines off and use named effects", () => {
  const bad = [];
  for (const row of stylesheetRows) {
    const selector = row.context.at(-1)?.selector ?? "";
    if (!selector.includes(":focus")) continue;
    const field = /(?:textarea|\.field input|\.(?:tw|c-q|c-name|lp|shd|lq)-in)[^,{]*:focus\b/.test(selector);
    if (field && row.property === "outline" && /^\d/.test(row.value)) bad.push(selector);
    if (/^(?:outline|box-shadow)/.test(row.property) && /--accent\b|accent-rgb/.test(row.value)) bad.push(selector);
  }
  assert.deepEqual(bad, []);
});
