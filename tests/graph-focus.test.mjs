// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

const dot = (selector) => /\.gn-d\b/.test(selector);
const focusDot = (selector) => /\.gn:focus-visible \.gn-d$/.test(selector);
/** @param {string} value */
const compactShadow = (value) => value.replace(/,\s*/g, ",");
const shadow = [
  "var(--gn-in,inset 0 0 #0000)", "0 0 0 2px var(--gn-gap)",
  "var(--gn-focus,0 0 #0000)", "var(--gn-halo,0 0 #0000)",
];

test("a graph dot composes its shadow from four independent layers", () => {
  assert.deepEqual(valuesFor(".gn-d", "box-shadow").map(compactShadow), [resolveValue(shadow.join(","))]);
  assert.deepEqual(valuesFor(".gn-d", "--gn-gap"), [resolveValue("var(--canvas)")]);
  assert.deepEqual(valuesFor((selector) => selector !== ".gn-d" && dot(selector), "box-shadow"), []);
});

test("keyboard focus is the only state that sets the graph focus layer", () => {
  assert.deepEqual(valuesFor(focusDot, "--gn-focus"), [resolveValue("0 0 0 4px var(--focus)")]);
  assert.deepEqual(valuesFor((selector) => dot(selector) && !focusDot(selector), "--gn-focus"), []);
});

test("graph dot states contribute to their own layer", () => {
  const states = [
    [".gn.k-dir:not(.is-open) .gn-d", "--gn-in", "inset 0 0 0 1.5px var(--ink-3)"],
    [".gn.is-here .gn-d", "--gn-halo", "0 0 0 5px color-mix(in srgb,var(--c) 25%,transparent)"],
    [".stage .map-host .gn-d", "--gn-gap", "var(--panel-canvas)"],
    [
      ':root[data-theme="light"] .stage .map-host .gn.is-here .gn-d',
      "--gn-in", "inset 0 0 0 1px color-mix(in srgb,var(--c) 70%,#000)",
    ],
  ];
  for (const [selector, property, value] of states) {
    assert.deepEqual(valuesFor(selector, property), [resolveValue(value)], selector);
  }
});

test("both hit pulse frames preserve the inset, gap and focus layers", () => {
  const frames = stylesheetRows.filter((row) => row.property === "box-shadow"
    && row.context.some((scope) => scope.at === "keyframes" && scope.params === "gn-hit"));
  assert.equal(frames.length, 2);
  const shared = resolveValue(shadow.slice(0, 3).join(",") + ",");
  assert.equal(typeof shared, "string");
  for (const frame of frames) {
    for (const value of [resolveValue(frame.value)].flat()) assert.ok(compactShadow(value).startsWith(shared));
  }
});
