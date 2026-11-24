// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

const captions = [".mx-cap", ".ximg-cap", ".md-dg-why"];

test("captions share the meta type and quiet ink across themes", () => {
  const selector = `:is(${captions.join(",")})`;
  assert.deepEqual(valuesFor(selector, "font"), [
    resolveValue("var(--fw-regular) var(--fs-meta)/var(--lh-meta) var(--sans)"),
  ]);
  assert.deepEqual(valuesFor(selector, "color"), [resolveValue("var(--ink-3)")]);
  assert.deepEqual(valuesFor(".mx-cap", "max-width"), ["66ch"]);
  assert.deepEqual(valuesFor(".mx-cap", "margin-bottom"), [resolveValue("var(--s-2)")]);
});

test("individual captions have no type or ink override", () => {
  for (const caption of captions) {
    for (const property of ["font", "font-size", "color"]) {
      assert.deepEqual(valuesFor(caption, property), [], `${caption} ${property}`);
    }
  }
});
