// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("literal gaps follow the spacing scale", () => {
  const scale = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64]);
  for (const row of stylesheetRows) {
    if (!/^(?:row-|column-)?gap$/.test(row.property ?? "")) continue;
    const value = row.value.replace(/\w*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
    for (const [, amount] of value.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)) {
      assert.ok(scale.has(Number(amount)), row.context.at(-1)?.selector);
    }
  }
});

test("one-line controls and the dock use the shared heights", () => {
  const control = resolveValue("var(--h-ctl)");
  assert.deepEqual(valuesFor(".badge", "gap"), ["8px"]);
  assert.deepEqual(valuesFor(".badge", "align-self"), ["center"]);
  assert.deepEqual(valuesFor(".badge", "height"), [control]);
  assert.deepEqual(valuesFor(".rn-st .badge", "height"), []);
  assert.ok(valuesFor(".b", "height").includes(control));
  assert.deepEqual(valuesFor(".ck-tog", "height"), [control]);
  assert.ok(valuesFor(".dis-h", "min-height").includes(control));
  assert.deepEqual(valuesFor(".tp-done", "min-height"), [resolveValue("var(--dock-bar)")]);

  const baseTokens = stylesheetRows.filter((row) => row.context.length === 2
    && row.context[0].params === "tokens" && row.context[1].selector === ":root");
  assert.equal(baseTokens.find((row) => row.property === "--dock-bar")?.value, "var(--h-row-act)");
  assert.equal(baseTokens.find((row) => row.property === "--dock-btn")?.value, "var(--h-ctl)");
});

test("the main bar has 12px vertical padding and the thread header stacks its back line", () => {
  assert.ok(valuesFor(".top", "min-height").includes(resolveValue("var(--h-bar)")));
  assert.deepEqual(valuesFor(".top", "padding"), [resolveValue("var(--s-3) var(--col-x)")]);
  const thread = '.top[data-kind="thread"]';
  assert.deepEqual(valuesFor(thread, "flex-direction"), ["column"]);
  assert.deepEqual(valuesFor(thread, "align-items"), ["stretch"]);
  assert.deepEqual(valuesFor(thread, "gap"), ["0"]);
  assert.deepEqual(valuesFor(thread, "padding"), [resolveValue("var(--s-2) var(--hg) var(--s-1)")]);
});

test("the sub-agents line is a 24px control with 4px before it", () => {
  assert.deepEqual(valuesFor(".rn-log", "height"), ["24px"]);
  assert.deepEqual(valuesFor(".rn-log", "margin-top"), ["4px"]);
});
