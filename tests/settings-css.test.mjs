// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("a link within a Settings row stays underlined and on one line", () => {
  const link = ".set-row a:not([class])";
  assert.ok(valuesFor(link, "white-space").includes("nowrap"));
  assert.ok(valuesFor(link, "text-decoration").includes("underline"));
});
