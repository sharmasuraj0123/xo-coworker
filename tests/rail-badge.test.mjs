// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { declarationsFor } from "./lib/css-snapshot.mjs";

test("the peek control shows an amber indicator when Home has decisions", () => {
  const badge = ".side-folded:has(#home-n:not(:empty)) [data-side-peek]::after";
  assert.deepEqual(declarationsFor(badge, "background").map(({ value }) => value), ["var(--warn)"]);
});
