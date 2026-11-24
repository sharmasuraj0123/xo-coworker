// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("the artifact search wrapper suppresses its outline when the field is focused", () => {
  const focus = /^:is\(([^)]+)\):has\(:is\(input,textarea\):focus-visible\)(?:,|$)/;
  const outlines = valuesFor((selector) => {
    const match = focus.exec(selector);
    return Boolean(match?.[1].split(",").some((item) => item.trim() === ".ar-q"));
  }, "outline");
  assert.deepEqual(outlines, ["none"]);
});
