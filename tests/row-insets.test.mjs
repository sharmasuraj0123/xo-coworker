// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

const tokens = tokenValuesFor();

/** @param {string} selector @param {string} property @param {string} expected */
function containsValue(selector, property, expected) {
  const values = valuesFor(selector, property);
  const resolved = resolveValue(expected);
  if (typeof resolved === "string") assert.ok(values.includes(resolved), selector + " " + property);
  else assert.ok(values.some((value) => Array.isArray(value)
    && value.length === resolved.length && value.every((entry, index) => entry === resolved[index])));
}

/** @param {string} property @param {string} value */
function phoneToken(property, value) {
  assert.ok(stylesheetRows.some((row) => row.property === property && row.value === value
    && row.context.at(-1)?.selector === ":root"
    && row.context.some((scope) => scope.at === "media" && scope.params === "(max-width:760px)")), property);
}

test("icon ink margins use the shared glyph proportions", () => {
  assert.equal(tokens.get("--ic-ink"), ".15");
  assert.equal(tokens.get("--ic-ink-chev"), ".21");
  assert.equal(tokens.get("--mark-ink"), "calc(2 / 24)");
});

test("folded asks and completed notices use concentric controls in the same bar", () => {
  const bars = ":is(.dock-fold,.card.is-dock.r-done)";
  containsValue(bars, "--nest-r", "var(--r-card)");
  containsValue(bars, "--nest-in", "calc((var(--dock-bar) - var(--dock-btn)) / 2 + 1px)");
  containsValue(bars, "border-radius", "var(--nest-r)");
  containsValue(".tp-done", "min-height", "var(--dock-bar)");
  containsValue(".dock-fold", "min-height", "calc(var(--dock-bar) + 2px)");
  for (const button of [".tp-done-u", ".df-go"]) {
    containsValue(button, "height", "var(--dock-btn)");
    containsValue(button, "border-radius", "calc(var(--nest-r) - var(--nest-in))");
  }
  phoneToken("--dock-bar", "var(--h-hit)");
  phoneToken("--dock-btn", "var(--h-touch)");
  assert.ok(!valuesFor((selector) => selector.includes(".tp-done"), "white-space").includes("normal"));
  containsValue(".tp-done>span:not(.tp-done-ic)", "white-space", "nowrap");
});

test("row edges preserve concentric control and glyph insets", () => {
  assert.equal(tokens.get("--edge-text"), "var(--s-3)");
  containsValue(".tp-done", "padding", "0 calc(var(--nest-in) - 1px) 0 calc(var(--edge-text) - var(--ic) * var(--ic-ink))");
  containsValue(".dock-fold", "padding", "0 calc(var(--nest-in) - 1px) 0 calc(var(--edge-text) - var(--ic-sm) * var(--mark-ink))");
  containsValue(".hr", "padding", "0 calc(var(--edge-text) - 1px) 0 calc(var(--edge-text) - 1px)");
  containsValue(".ck-tog", "padding", "0 calc(var(--edge-text) - var(--ic) * var(--ic-ink-chev)) 0 var(--edge-text)");
});

test("herald notices use the pill dimensions with a bare icon and nested controls", () => {
  assert.equal(tokens.get("--note-h"), "var(--h-ctl)");
  assert.equal(tokens.get("--note-btn"), "var(--h-sm)");
  phoneToken("--note-h", "var(--h-touch)");
  containsValue(".hr", "--note-in", "calc((var(--note-h) - var(--note-btn)) / 2)");
  containsValue(".hr", "height", "calc(var(--note-h) + 2px)");
  containsValue(".hr", "border-radius", "var(--r-pill)");
  containsValue(".hr", "background", "var(--glass)");
  containsValue(".hr", "border", "1px solid transparent");
  containsValue(".hr:has(>:is(.hr-go,.hr-undo))", "padding-right", "calc(var(--note-in) - 1px)");
  for (const property of ["background", "border-radius", "width"]) assert.deepEqual(valuesFor(".hr-ic", property), []);
  for (const button of [".hr-go", ".hr-undo"]) {
    containsValue(button, "height", "var(--note-btn)");
    containsValue(button, "border-radius", "var(--r-pill)");
  }
  containsValue(".hr:has(>.hr-undo)", "--note-btn", "var(--h-touch)");
  containsValue(".hr:has(>.hr-undo)", "--note-h", "calc(var(--note-btn) + 2 * var(--s-1))");
  const herald = (selector) => /\.hr(?:-ev)?\b/.test(selector);
  assert.ok(!valuesFor(herald, "min-height").flat().includes("38px"));
  assert.ok(!valuesFor(herald, "padding").flat().some((value) => /^5px\b/.test(value)));
});

test("the herald truncates its title and subline while preserving button widths", () => {
  containsValue(".hr", "max-width", "100%");
  containsValue(".hr-t", "min-width", "0");
  containsValue(".hr-s", "flex-shrink", "1000");
  for (const text of [".hr-t", ".hr-s"]) {
    containsValue(text, "overflow", "hidden");
    containsValue(text, "text-overflow", "ellipsis");
  }
  assert.ok(!valuesFor(".hr-t", "flex").includes("none"));
  for (const button of [".hr-go", ".hr-undo"]) containsValue(button, "flex", "none");
  containsValue(".hr-ev.k-stopped .hr-t", "flex", "1 1 0");
});
