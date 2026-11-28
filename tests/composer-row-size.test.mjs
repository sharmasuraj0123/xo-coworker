// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("the composer target and model chip share icon size and meta type", () => {
  const shared = ":is(.target,.iq)";
  assert.deepEqual(valuesFor(shared, "--ic"), [resolveValue("var(--ic-sm)")]);
  assert.deepEqual(valuesFor(shared, "font-size"), [resolveValue("var(--fs-meta)")]);
  assert.deepEqual(valuesFor(shared, "line-height"), [resolveValue("var(--lh-meta)")]);
  const phoneRule = stylesheetRows.some((row) => row.context.at(-1)?.selector === shared
    && row.context.some((scope) => scope.at === "media" && scope.params.includes("max-width:760px")));
  assert.equal(phoneRule, false);
  assert.deepEqual(valuesFor((selector) => selector.includes(".tp-target")), []);

  for (const [selector, width] of [[".target .muted", 600], [".target .tg-w", 520]]) {
    const hidden = stylesheetRows.some((row) => row.context.at(-1)?.selector === selector
      && row.property === "display" && row.value === "none"
      && row.context.some((scope) => scope.at === "container" && scope.params === "(max-width:" + width + "px)"));
    assert.ok(hidden, selector);
  }
});

test("neither composer control overrides its own base type size", () => {
  for (const selector of [".target", ".iq", ":root:root .iq"]) {
    for (const property of ["font", "font-size"]) assert.deepEqual(valuesFor(selector, property), [], selector);
  }
});

test("the target icon uses the shared size and gap", () => {
  assert.deepEqual(valuesFor(".target svg", "flex"), ["none"]);
  for (const side of ["width", "height"]) {
    assert.deepEqual(valuesFor(".target svg", side), [resolveValue("var(--ic)")]);
  }
  assert.deepEqual(valuesFor(".target", "gap"), [resolveValue("var(--gap-icon)")]);
});

test("the target gives way before the model chip, keeping Send in bounds", () => {
  assert.deepEqual(valuesFor(".iq", "flex"), ["0 1 auto"]);
  const maximum = resolveValue("min(320px,100% - var(--h-ctl) - var(--h-lg) - 3 * var(--s-2))");
  assert.deepEqual(valuesFor(".iq", "max-width"), [maximum]);
  assert.deepEqual(valuesFor(".composer-row", "gap"), [resolveValue("var(--s-2)")]);
  for (const property of ["max-width", "flex"]) assert.deepEqual(valuesFor(":root:root .iq", property), []);
});
