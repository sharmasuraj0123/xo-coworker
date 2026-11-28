// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { declarationsFor, valuesFor } from "./lib/css-snapshot.mjs";

test("the folded rail shows an amber number and hides the count's icon", () => {
  const count = ".side-folded .nr-n:not(:empty)";
  for (const [property, expected] of [
    ["position", "absolute"], ["background", "var(--warn)"], ["color", "var(--sb-side)"],
    ["height", "var(--s-4)"], ["min-width", "var(--s-4)"], ["border-radius", "var(--r-pill)"], ["font-size", "var(--fs-meta)"],
  ]) {
    assert.deepEqual(declarationsFor(count, property).map(({ value }) => value), [expected], property);
  }
  for (const { value } of declarationsFor(count)) assert.doesNotMatch(value, /\d+px/);
  assert.deepEqual(valuesFor(".side-folded .nr-n .nv-dot", "display"), ["none"]);
});
