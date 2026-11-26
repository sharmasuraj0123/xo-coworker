// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { space } from "../reducers/space.js";

test("runtimes.changed reads the runtimes again", () => {
  let reads = 0;
  const fake = { refreshRuntimes: () => { reads++; } };
  const ctx = /** @type {Parameters<typeof space["runtimes.changed"]>[0]} */ (/** @type {unknown} */ (fake));
  space["runtimes.changed"](ctx, {}, {}, null, "runtimes.changed");
  assert.equal(reads, 1);
});
