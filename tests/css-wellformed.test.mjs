// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { rootTokenModel } from "../tools/conformance/css-root-tokens.mjs";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { declarationsFor, resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

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
  const dividers = declarationsFor(".thead", "border-bottom");
  const headerRows = stylesheetRows.filter((row) => !row.context.at(-1)?.selector?.endsWith(" :is(.toast,.lbx)"));
  const { contexts } = rootTokenModel(headerRows, new Set());
  const expected = { dark: "#1F1F1F", light: "#E6E6E6" };
  for (const { state, values } of contexts) {
    const paletteLine = state.theme === "dark" ? "--line-faint" : "--line-soft";
    const color = state.flavour ? values.get(paletteLine) : expected[state.theme];
    assert.ok(color, JSON.stringify(state));
    assert.deepEqual(dividers.map(({ value }) => substitute(value, values)), [`1px solid ${color}`], JSON.stringify(state));
  }
});
