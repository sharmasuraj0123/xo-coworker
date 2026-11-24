// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

test("Map status tags keep full-opacity secondary text at regular weight", () => {
  assert.deepEqual(declarationsFor(".dg-tag span", "opacity"), []);
  assert.deepEqual(valuesFor(".dg-tag span", "font-weight"), [tokenValuesFor().get("--fw-regular")]);
});

test("an idle Map tag uses the primary ink over the idle fill", () => {
  const idle = ".dg-cur.is-idle .dg-tag";
  assert.ok(declarationsFor(idle, "background").some((row) => row.value === "var(--fill-4)"));
  assert.ok(declarationsFor(idle, "color").some((row) => row.value === "var(--ink)"));
});
