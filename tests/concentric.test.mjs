// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, tokenValuesFor } from "./lib/css-snapshot.mjs";

const NEST = "calc(var(--nest-r) - var(--nest-in))";
const tokens = tokenValuesFor();

/** @param {string} selector @param {Record<string, string>} expected */
function hasDeclarations(selector, expected) {
  for (const [property, value] of Object.entries(expected)) {
    const actual = declarationsFor(selector, property).map((row) => row.value);
    assert.ok(actual.includes(value), `${selector} ${property}: expected ${value}; found ${actual.join(", ")}`);
  }
}

test("sidebar tiles derive their concentric inset from the row and tile", () => {
  assert.equal(tokens.get("--tile-sm"), "28px");
  hasDeclarations(".nrow,.prow", {
    "--nest-r": "var(--r-lg)",
    "--nest-in": "calc((var(--h-row) - var(--tile-sm)) / 2)",
    "min-height": "var(--h-row)",
    padding: "calc(var(--nest-in) - 1px) 10px calc(var(--nest-in) - 1px) calc(var(--nest-in) - 1px)",
    "border-radius": "var(--nest-r)",
  });
  hasDeclarations(".nr-ic,.pr-ic", { width: "var(--tile-sm)", height: "var(--tile-sm)", "border-radius": NEST });
  assert.deepEqual(declarationsFor(".nr-ic,.pr-ic", "border-radius").map((row) => row.value), [NEST]);
  hasDeclarations(".side :is(.nrow,.prow):focus-visible", { "border-radius": "var(--nest-r)" });
});

test("sidebar menus and the editor derive row corners from the padding and border", () => {
  for (const [property, value] of Object.entries({
    "--r-menu": "var(--r-lg)", "--menu-pad": "var(--s-1)", "--menu-row": "var(--h-ctl)",
    "--r-pop-row": "calc(var(--r-menu) - var(--menu-pad) - 1px)",
    "--r-xl-in": "calc(var(--r-xl) - var(--s-2) - 1px)",
  })) assert.equal(tokens.get(property), value, property);
  hasDeclarations(".side-pop", { padding: "var(--s-2)", "border-radius": "var(--r-xl)" });
  hasDeclarations(".side-pop .nrow", { "--nest-r": "var(--r-pop-row)" });
  hasDeclarations(".side-pop[role=menu]", {
    "min-width": "var(--menu-w)", padding: "var(--menu-pad)", "border-radius": "var(--r-menu)",
  });
  hasDeclarations(".side-pop[role=dialog] .nrow", { "--nest-r": "var(--r-xl-in)" });
});

test("the model picker's footer buttons sit in its inset corner", () => {
  hasDeclarations(".iq-pop", {
    "--nest-r": "var(--r-menu)", "--nest-in": "calc(var(--menu-pad) + 1px)", "border-radius": "var(--nest-r)",
  });
  hasDeclarations(".iq-f", { padding: "var(--s-1) 0 0 var(--s-2)" });
  for (const selector of [".iq-back", ".iq-done"]) hasDeclarations(selector, { "border-radius": NEST });
});

test("menus use the shared padding, height and corner tokens", () => {
  for (const [box, row] of [
    [".tw-menu", ".tw-menu button"], [".vw-menu", ".vw-menu :is([role=menuitem],[role=menuitemradio])"],
    [".dd-menu", ".dd-row"], [".lp-mn", ".lp-mn :is(button,a)"], [".fl-menu", ".fl-menu button"],
  ]) {
    hasDeclarations(box, { padding: "var(--menu-pad)", "border-radius": "var(--r-menu)" });
    hasDeclarations(row, { height: "var(--menu-row)", "border-radius": "var(--r-pop-row)" });
  }
  hasDeclarations(".side-pop[role=menu] .nrow", { gap: "var(--s-2)", "min-height": "var(--menu-row)", padding: "0 var(--s-2)" });
  hasDeclarations(".side-pop[role=menu] .nr-ic", { width: "var(--ic)", height: "var(--ic)", background: "none", border: "0" });
});

test("Artifacts, mentions, Next and dock keep their nested corners", () => {
  hasDeclarations(".md-well", { "border-radius": `${NEST} ${NEST} 0 0` });
  hasDeclarations(".md-pin", { position: "absolute", top: "var(--cell-in)", right: "var(--cell-in)", "border-radius": NEST });
  hasDeclarations(".at-list li", { "border-radius": NEST });
  hasDeclarations(".at-list", {
    "--nest-r": "var(--r-lg)", "--nest-in": "7px", padding: "6px", "border-radius": "var(--nest-r)",
  });
  hasDeclarations(".next", { "--nest-r": "var(--r-card)", "--nest-in": "var(--card-in)" });
  hasDeclarations(":is(.card,.next) :is(.c-btns,.c-opts) .b", { "border-radius": NEST });
  const legacy = declarationsFor(".c-btns .b", "border-radius");
  assert.ok(legacy.every((row) => row.value !== "calc(var(--r-2xl) - 13px)"));
});
