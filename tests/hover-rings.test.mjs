// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("hover rules do not draw a border, outline or ring shadow", () => {
  const byRule = new Map();
  for (const row of stylesheetRows) {
    const selector = row.context.at(-1)?.selector;
    if (!row.property || !selector?.includes(":hover")) continue;
    const enabledSelector = selector.replace(/:not\([^)]*\)/g, "");
    if (/:disabled|\[aria-disabled="true"\]/.test(enabledSelector)) continue;
    const values = byRule.get(row.context) ?? new Map();
    values.set(row.property, row.value);
    byRule.set(row.context, values);
  }
  const rings = [];
  for (const [context, values] of byRule) {
    for (const [property, value] of values) {
      const border = /^border(-\w+)?-color$/.test(property) && !value.includes("transparent")
        && value !== values.get("background") && value !== values.get("background-color");
      const outline = /^outline(-color)?$/.test(property) && !["none", "0"].includes(value);
      const shadow = property === "box-shadow" && value !== "none" && /inset|(^|,)\s*0 0 0 \d/.test(value);
      if (border || outline || shadow) rings.push({ selector: context.at(-1).selector, property, value });
    }
  }
  assert.deepEqual(rings, []);
});

test("the herald's hover uses its fill over the glass", () => {
  const fill = "linear-gradient(var(--hover-fill),var(--hover-fill)),var(--glass)";
  assert.deepEqual(valuesFor("button.hr:hover", "background"), [resolveValue(fill)]);
});

test("keyboard focus keeps the soft ring", () => {
  assert.ok(valuesFor(":focus-visible", "outline").some((value) =>
    JSON.stringify(value) === JSON.stringify(resolveValue("3px solid var(--focus)"))));
  assert.ok(valuesFor(":focus-visible", "outline-offset").includes("0"));
});
