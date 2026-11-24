// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";

const rules = publishedRules();

/** @param {string} actual @param {string} expected */
function sameValue(actual, expected) {
  if (actual === expected) return true;
  return JSON.stringify(resolveValue(actual)) === JSON.stringify(resolveValue(expected));
}

/** @param {string} selector @param {Record<string, string>} properties */
function hasRule(selector, properties) {
  return rules.some(rule => rule.sel === selector && Object.entries(properties).every(([name, expected]) =>
    rule.declarations.some(({ p, v }) => p === name && sameValue(v, expected))));
}

test("the artifact card draws its keyboard ring above the picture", () => {
  assert.ok(hasRule(".md-th", { position: "relative" }));
  assert.ok(hasRule(".md-it", { position: "relative" }));
  assert.ok(hasRule(".md-open:focus-visible", { outline: "none" }));
  assert.ok(hasRule(".md-it:has(.md-open:focus-visible)::after", {
    content: '""', position: "absolute", inset: "0", "z-index": "2",
    "border-radius": "inherit", "pointer-events": "none", "box-shadow": "inset 0 0 0 2px var(--focus)",
  }));
  const sharedInset = rules.filter(({ sel }) => sel.startsWith(":is(") && sel.endsWith("):focus-visible"));
  assert.ok(!sharedInset.some(rule => rule.sel.includes(".md-open")
    && rule.declarations.some(({ p, v }) => p === "outline-offset" && resolveValue(v) === "-2px")));
});

test("a picture message draws its keyboard ring over the image", () => {
  assert.ok(hasRule(".mx-img", { position: "absolute" }));
  assert.ok(hasRule(".mx-tile:focus-visible", { "z-index": "3", outline: "none" }));
  assert.ok(hasRule(".mx-tile:focus-visible::after", {
    content: '""', position: "absolute", inset: "0", "z-index": "3", "box-shadow": "inset 0 0 0 2px var(--focus)",
  }));
});

test("hover styles distinguish the pinned glyph in both themes", () => {
  assert.ok(hasRule(".md-it.is-pin .md-pin", { color: "var(--accent)" }));
  assert.ok(hasRule(".md-it.is-pin .md-pin:hover", { color: "var(--accent-hover)" }));
  assert.ok(hasRule(".md-pin:hover", { background: "color-mix(in srgb,var(--fill-3) 92%,transparent)", color: "var(--ink)" }));
  assert.ok(hasRule(':root[data-theme="light"] .md-pin:hover', { background: "var(--surface)" }));
  assert.ok(hasRule(':root[data-theme="light"] .md-it.is-pin .md-pin:hover',
    { color: "color-mix(in srgb,var(--accent) 75%,var(--ink))" }));
});
