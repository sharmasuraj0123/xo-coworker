// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules, resolveValue, tokenValuesFor } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const stageList = (selector) => /^\.stage\b/.test(selector) && /\.(?:fr-b|ch-old|ag-list|ch-list)\b/.test(selector);
const launchpad = (selector) => /\.(?:lp(?:-[\w-]+)?|lq(?:-[\w-]+)?)\b|#launchpad\b/.test(selector);

test("stage lists size their scroll area without quantizing it to a row grid", () => {
  for (const { sel, declarations } of rules) {
    if (!stageList(sel)) continue;
    for (const { p, v } of declarations) {
      if (!/^(?:(?:min|max)-)?(?:height|block-size)$/.test(p)) continue;
      assert.doesNotMatch(v, /round\(\s*down\s*,\s*100cqh\s+-\s+44px\s*,\s*48px\s*\)/, sel);
    }
  }
  const maxHeights = declarationsFor('.stage .fr.is-grow[data-fr="agents"] .fr-b', "max-height");
  assert.deepEqual(maxHeights.map(({ value }) => value), ["none"]);
  for (const [property, expected] of [["flex", "0 1 auto"], ["min-height", "0"], ["margin-bottom", "8px"], ["overflow", "auto"]]) {
    assert.ok(declarationsFor(".stage .ch-old", property).some(({ value }) => resolveValue(value) === expected), property);
  }
});

test("stage lists stop at their line with no fade over the last row", () => {
  assert.equal(tokenValuesFor().get("--edge-fade"), undefined);
  for (const { sel, declarations } of rules) {
    if (!stageList(sel)) continue;
    for (const { p } of declarations) assert.doesNotMatch(p, /^(?:-webkit-)?mask(?:-image)?$/, sel);
  }
});

test("stage list and Launchpad masks have no hard-coded fade distance", () => {
  for (const { sel, declarations } of rules) {
    if (!stageList(sel) && !launchpad(sel)) continue;
    for (const { p, v } of declarations) {
      if (!/^(?:-webkit-)?mask(?:-image)?$/.test(p)) continue;
      assert.doesNotMatch(v, /calc\(\s*100%\s+-\s+32px\s*\)/, sel);
    }
  }
});
