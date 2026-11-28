// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("focused viewer and routing segments stack over their neighbours", () => {
  const segment = ":is(.vw-seg,.rt-seg)>button:focus-visible";
  assert.deepEqual(valuesFor(segment, "position"), ["relative"]);
  assert.deepEqual(valuesFor(segment, "z-index"), ["1"]);
  for (const group of [".vw-seg", ".rt-seg"]) {
    assert.ok(valuesFor(group, "gap").includes("2px"), group);
  }
});
