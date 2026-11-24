// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { FLAVOURS } from "../core/ui/flavours.js";
import { resolveValue, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

test("primary actions default to the accent colours", () => {
  const roles = tokenValuesFor();
  for (const [role, accent] of [
    ["--pri-fill", "var(--accent-fill)"], ["--pri-fill-hover", "var(--accent-hover)"],
    ["--pri-fill-press", "var(--accent-press)"], ["--pri-ink", "var(--accent-ink)"],
  ]) assert.equal(roles.get(role), accent, role);
});

test("only ink-primary flavours switch all four primary action roles", () => {
  const expected = FLAVOURS.filter((flavour) => flavour.primary === "ink").map((flavour) => flavour.id);
  assert.ok(expected.length > 0 && expected.length < FLAVOURS.length);
  const overrides = stylesheetRows.filter((row) => row.property === "--pri-fill"
    && row.context.at(-1)?.selector !== ":root");
  const selectors = expected.map((flavour) => ':root[data-flavour="' + flavour + '"]');
  assert.deepEqual(overrides.map((row) => row.context.at(-1).selector), selectors);
  for (const selector of selectors) {
    const roles = new Map(stylesheetRows.filter((row) => row.property && row.context.at(-1)?.selector === selector)
      .map((row) => [row.property, row.value.trim()]));
    assert.equal(roles.get("--pri-fill"), "var(--ink)");
    assert.equal(roles.get("--pri-fill-hover"), "var(--ink-hi)");
    assert.equal(roles.get("--pri-fill-press"), "color-mix(in srgb,var(--ink) 76%,var(--canvas))");
    assert.equal(roles.get("--pri-ink"), "var(--on-ink)");
  }
});

test("main actions use primary roles while Send on a card and picker Done use ink", () => {
  const specifications = [
    [".btn-pri", "var(--pri-fill)", "var(--pri-ink)", true],
    [".xd-btn.is-pri", "var(--pri-fill)", "var(--pri-ink)", true],
    [".send", "var(--pri-fill)", "var(--pri-ink)", false],
    [".xd-q .xd-send", "var(--pri-fill)", "var(--pri-ink)", false],
    [".b-go", "var(--ink)", "var(--on-ink)", true],
    [".iq-done", "var(--ink)", "var(--on-ink)", false],
  ];
  for (const [selector, fill, ink, edge] of specifications) {
    assert.deepEqual(valuesFor(selector, "background"), [resolveValue(fill)]);
    assert.deepEqual(valuesFor(selector, "color"), [resolveValue(ink)]);
    if (edge) assert.deepEqual(valuesFor(selector, "border-color"), [resolveValue(fill)]);
  }
  const rawAccent = stylesheetRows.filter((row) => row.property && row.value
    && /(?:\.btn-pri|\.xd-btn\.is-pri|\.b-go|\.iq-done|\.send|\.xd-send)[^,]*$/.test(row.context.at(-1)?.selector ?? "")
    && /var\(--accent-(?:fill|hover|press)\)/.test(row.value));
  assert.deepEqual(rawAccent, []);
});

test("prose link colours and decorations only target unclassed links", () => {
  const rules = stylesheetRows.filter((row) => /^(?:color|text-decoration)/.test(row.property ?? "")
    && (row.context.at(-1)?.selector ?? "").split(",").some((selector) => /\s a(?::hover|:visited)?$/.test(selector.trim())));
  assert.deepEqual(rules, []);
});
