// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("the chat notice stays fixed above an overlaying panel", () => {
  const selector = "body.stage-covers .herald:not(.tp .herald)";
  assert.deepEqual(valuesFor(selector, "position"), ["fixed"]);
});
