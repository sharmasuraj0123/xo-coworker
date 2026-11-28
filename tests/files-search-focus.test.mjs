// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules, tokenValuesFor } from "./lib/css-snapshot.mjs";

test("the Files search field uses distinct resting and focus edges in both themes", () => {
  const rules = publishedRules();
  const focus = rules.filter(({ sel }) => sel === ".fl-q:focus-within").flatMap(({ declarations }) => declarations);
  assert.deepEqual(focus.filter(({ p }) => p === "border-color").map(({ v }) => v), ["var(--field-line-focus)"]);
  assert.ok(rules.some(({ sel, declarations }) => sel === ".fl-q"
    && declarations.some(({ p, v }) => p === "border" && v.endsWith("var(--field-line)"))));
  for (const theme of [":root", ':root[data-theme="light"]']) {
    const roles = tokenValuesFor(theme);
    assert.ok(roles.has("--field-line") && roles.has("--field-line-focus"));
    assert.notEqual(roles.get("--field-line"), roles.get("--field-line-focus"));
  }
});
