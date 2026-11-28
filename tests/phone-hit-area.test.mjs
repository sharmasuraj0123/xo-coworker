// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("phone touch extensions only attach to positioned controls", () => {
  const extension = /^:root:root :is\(([^)]*)\)::after$/;
  const inset = stylesheetRows.find((row) => row.property === "inset"
    && extension.test(row.context.at(-1)?.selector ?? "")
    && row.context.some((scope) => scope.at === "media"));
  assert.ok(inset);
  assert.equal(resolveValue(inset.value), "-8px");
  const extensionSelector = inset.context.at(-1).selector;
  assert.deepEqual(valuesFor(extensionSelector, "position"), ["absolute"]);
  assert.deepEqual(valuesFor(extensionSelector, "content"), ['""']);
  const controls = extension.exec(extensionSelector)[1].split(",").map((control) => control.trim());

  for (const row of stylesheetRows) {
    const selector = row.context.at(-1)?.selector ?? "";
    if (row.property !== "position" || row.value !== "static" || !controls.some((control) => selector.endsWith(control))) continue;
    assert.ok(valuesFor(":root:root " + selector + "::after", "content").includes("none"), selector);
  }
});

test("the Artifacts list's pin has no touch extension", () => {
  const pin = ":root:root .arts:not(.is-pics) .ar-grid .md-pin::after";
  assert.deepEqual(valuesFor(pin, "content"), ["none"]);
});
