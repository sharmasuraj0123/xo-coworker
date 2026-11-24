// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("published CSS rules have complete selectors", () => {
  const selectors = new Set(stylesheetRows.flatMap((row) => row.context.map((scope) => scope.selector)).filter(Boolean));
  for (const selector of selectors) {
    const unquoted = selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "");
    assert.doesNotMatch(unquoted, /["']|\*\//, selector);
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      assert.equal(unquoted.split(open).length, unquoted.split(close).length, selector);
    }
    const bare = unquoted.replace(/\([^()]*\)|\[[^\]]*\]/g, "");
    assert.doesNotMatch(bare, /(?:^|[\s,])[a-z]{2,}\s+[a-z]{2,}\s+[a-z]{2,}(?:\s+[a-z]{2,})/i, selector);
  }
});

test("the thread header strip retains its shared edges and separator", () => {
  assert.deepEqual(valuesFor(".thead", "flex"), ["none"]);
  assert.deepEqual(valuesFor(".thead", "padding"), [resolveValue("var(--s-1) var(--hg) var(--s-2)")]);
  assert.deepEqual(valuesFor(".thead", "border-bottom"), [resolveValue("1px solid var(--line-faint)")]);
});
