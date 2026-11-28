// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

test("the Markdown page and its blocks have no hover styles", () => {
  const hovers = (selector) => selector.includes(":hover")
    && /\.cm-md-|\.cm-xo-page|\.vw-doc \.cm-(?:content|line|editor)\b/.test(selector);
  assert.deepEqual(valuesFor(hovers), []);
});

test("focused Markdown table cells have an inset edge and a fill", () => {
  const cell = ".cm-md-table td:focus,.cm-md-table th:focus";
  assert.deepEqual(valuesFor(cell, "box-shadow"), [resolveValue("inset 0 0 0 1px var(--line-strong)")]);
  assert.deepEqual(valuesFor(cell, "background"), [resolveValue("var(--hover-fill)")]);
});
