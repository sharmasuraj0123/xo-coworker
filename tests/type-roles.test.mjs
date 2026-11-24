// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules, tokenValuesFor } from "./lib/css-snapshot.mjs";
import { valueTokens } from "../tools/conformance/css-values.mjs";

const sizes = ["meta", "ui", "code", "read", "title", "input", "heading", "display", "hero"];
const heights = ["meta", "ui", "read", "title", "heading", "display", "hero"];
const weights = ["regular", "read", "medium", "strong"];
const roles = new Set([
  ...sizes.map((role) => "--fs-" + role),
  ...heights.map((role) => "--lh-" + role),
  ...weights.map((role) => "--fw-" + role),
]);
const rules = publishedRules().filter(({ f }) => !f?.startsWith("/apps-host/"));

test("the shared scale publishes one set of size and line-height roles", () => {
  const tokens = tokenValuesFor();
  const names = [...tokens.keys()];
  assert.deepEqual(names.filter((name) => name.startsWith("--fs-")).sort(), sizes.map((role) => "--fs-" + role).sort());
  assert.deepEqual(names.filter((name) => name.startsWith("--lh-")).sort(), heights.map((role) => "--lh-" + role).sort());
  for (const [role, value] of [["read", "16px"], ["ui", "14px"], ["meta", "12px"]]) {
    assert.equal(tokens.get("--fs-" + role), value);
  }
});

test("reading carries the full ink and regular weight in each theme", () => {
  const defaults = tokenValuesFor();
  const light = new Map([...defaults, ...tokenValuesFor(':root[data-theme="light"]')]);
  for (const tokens of [defaults, light]) {
    assert.equal(tokens.get("--ink-read"), "var(--ink)");
    assert.equal(tokens.get("--fw-read"), "var(--fw-regular)");
  }
});

test("page titles, including the rename field, use the title role", () => {
  for (const selector of [".tw-h", ".tw-t h1", ".tw-in"]) {
    const fonts = declarationsFor(selector, "font").map(({ value }) => value);
    assert.ok(fonts.some((value) => value.includes("var(--fs-title)/var(--lh-title)")), selector);
  }
});

test("published type declarations use the shared roles and avoid bold meta text", () => {
  for (const { f, sel, declarations } of rules) {
    if (f === "/core/ui/tokens.css") continue;
    const location = f + " " + sel;
    let meta = false;
    let strong = false;
    for (const { p, v } of declarations) {
      const parts = valueTokens(v).map(({ text }) => text).filter((text) => text.trim());
      for (const name of parts) {
        if (/^--(?:fs|fw|lh)-/.test(name)) assert.ok(roles.has(name), location + " " + name);
      }
      if (p === "font" || p === "font-size") {
        assert.ok(!/^\d+(?:\.\d+)?px$/.test(parts[0] ?? ""), location);
        meta ||= parts.includes("--fs-meta");
      }
      if (p === "font" || p === "font-weight") {
        assert.ok(!/^\d{3}$/.test(parts[0] ?? ""), location);
        strong ||= parts.includes("--fw-strong");
      }
    }
    assert.ok(!(meta && strong), location);
  }
});

test("the composer, bubbles and tables use reading type", () => {
  for (const selector of [".prose", ".bubble", ".composer textarea", ".md-table table"]) {
    assert.ok(declarationsFor(selector, "font-size").some(({ value }) => value === "var(--fs-read)"), selector);
    assert.ok(declarationsFor(selector, "font-weight").some(({ value }) => value === "var(--fw-read)"), selector);
  }
});

test("menus and the model picker share the interface and meta roles", () => {
  const menus = /^(?:\.iq-|\.tw-menu|\.vw-menu|\.dd-(?:menu|row)|\.lp-mn|\.fl-menu|\.side-pop)/;
  for (const rule of rules.filter((candidate) => menus.test(candidate.sel))) {
    for (const declaration of rule.declarations.filter(({ p }) => p === "font" || p === "font-size")) {
      const parts = valueTokens(declaration.v).map(({ text }) => text);
      const size = parts.find((text) => /^--fs-|^\d+(?:\.\d+)?px$/.test(text));
      if (size) {
        assert.ok(size === "--fs-ui" || size === "--fs-meta", rule.sel + " " + size);
      }
    }
  }
  assert.ok(declarationsFor(":is(.target,.iq)", "font-size").some(({ value }) => value === "var(--fs-meta)"));
  for (const selector of [".iq-n", ".iq-more"]) {
    assert.ok(declarationsFor(selector, "font").some(({ value }) => value.includes("var(--fs-meta)/var(--lh-meta)")), selector);
  }
  for (const selector of [".iq-row", ".iq-more"]) {
    assert.ok(declarationsFor(selector, "height").some(({ value }) => value === "var(--menu-row)"), selector);
  }
});
