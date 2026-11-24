// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { templateElements } from "../tools/conformance/templates.mjs";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";

test("every focusable separator paints a ring across its grab area", () => {
  const elements = templateElements(fileURLToPath(new URL("../", import.meta.url)));
  const grips = new Set(elements.filter((node) => node.matches('[role="separator"][tabindex="0"]'))
    .flatMap((node) => [...node.classList]));
  assert.deepEqual([...grips].sort(), ["fl-split", "fr-gut", "shd-grip", "stg-grip"]);

  const rules = publishedRules();
  /** @param {string} selector @param {Record<string, string>} expected */
  const draws = (selector, expected) => rules.some(({ sel, declarations }) => sel === selector
    && Object.entries(expected).every(([name, value]) => declarations.some(({ p, v }) =>
      p === name && JSON.stringify(resolveValue(v)) === JSON.stringify(resolveValue(value)))));
  assert.ok(draws(".shd-grip:focus-visible", { "outline-offset": "-8px" }));
  assert.ok(!draws(".shd-grip", { outline: "none" }));
  const outline = "2px solid var(--ring-in,var(--focus))";
  assert.ok(draws(".stage .fr-gut:focus-visible", { outline }));
  assert.ok(draws(".stg-grip:focus-visible", { outline, "outline-offset": "-2px", "border-radius": "3px" }));
  assert.ok(draws(".stg-grip", { outline: "none" }));
  assert.ok(draws(".fv .fl.is-wide .fl-split:focus-visible::after", {
    "box-shadow": "inset 0 0 0 2px var(--focus)", "border-radius": "3px",
  }));
  assert.ok(draws(".fv .fl.is-wide .fl-split::after", {
    content: '""', position: "absolute", top: "0", bottom: "0", left: "-4px", width: "9px",
  }));
});
