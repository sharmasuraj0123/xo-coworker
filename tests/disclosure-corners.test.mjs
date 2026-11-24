// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("the inner corner radius is the outer radius minus its stroke", () => {
  const innerRadius = resolveValue("var(--r-lg-in)");
  assert.deepEqual(innerRadius, resolveValue("calc(var(--r-lg) - 1px)"));
  assert.deepEqual(valuesFor(".ck-tog", "border-radius"), [innerRadius]);
  const duplicate = stylesheetRows.filter((row) => row.property !== "--r-lg-in"
    && /^calc\(var\(--r-lg\) - (?:1px|var\(--hair\))\)$/.test(row.value ?? ""));
  assert.deepEqual(duplicate, []);
});

test("the open checklist toggle squares the corners where it meets its list", () => {
  assert.deepEqual(valuesFor(".ckbar.is-open .ck-tog", "border-end-start-radius"), ["0"]);
  assert.deepEqual(valuesFor(".ckbar.is-open .ck-tog", "border-end-end-radius"), ["0"]);
});
