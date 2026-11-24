// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { templateElements } from "../tools/conformance/templates.mjs";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { isPhone } from "./lib/cascade.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const rules = publishedRules();
const buttons = new Set(templateElements(root).filter(({ localName }) => localName === "button")
  .map((node) => [...node.classList][0]).filter((name) => name && /^[\w-]+$/.test(name) && !/^(is|st|k|m|t|r|e)-/.test(name)));
const hovers = rules.filter(({ sel }) => sel.includes(":hover"));

/** @param {string} name */
function answers(name) {
  const ownClass = new RegExp(`\\.${name}(?![\\w-])`);
  if (hovers.some(({ sel }) => ownClass.test(sel))) return true;
  const rest = rules.find(({ sel }) => sel === `.${name}`);
  return rest?.declarations.some(({ p, v }) => p === "color" && ["var(--ink-3)", "var(--ink-4)"].includes(v));
}

/** @param {string} selector @param {string} property @param {string} value */
const declares = (selector, property, value) => rules.some(({ sel, declarations }) => sel === selector
  && declarations.some(({ p, v }) => p === property && v === value));

const other = {
  "tc-open": () => hovers.some(({ sel }) => sel === ".tcard:hover"),
  "vw-fold": () => declares("[role=menu] :is([role=menuitem],[role=menuitemradio]):focus", "background", "var(--menu-focus)"),
  "side-x": () => declares(".side-x", "display", "none"),
  "top-menu": () => declares(".top-menu", "display", "none"),
  "rn-live": () => declares(".rn-live", "display", "none"),
  "pb-menu": () => rules.some((rule) => rule.sel === ".pb-menu" && isPhone(rule)
    && rule.declarations.some(({ p, v }) => p === "display" && v === "grid")),
};

test("each classed button offers visible pointer feedback", () => {
  for (const name of ["meta-btn", "hr-undo", "xd-send", "rn-live", "c-where", "ev-undo"]) assert.ok(buttons.has(name), name);
  assert.ok(buttons.size > 120, `${buttons.size} classes in the control census`);
  assert.deepEqual([...buttons].filter((name) => !answers(name) && !(name in other)).sort(), [], "missing pointer feedback");
  for (const [name, alternative] of Object.entries(other)) {
    assert.ok(alternative(), `${name} lost its alternate feedback`);
    assert.ok(!answers(name), `${name} now has its own feedback`);
  }
});

test("buttons without their own classes retain the parent treatment", () => {
  const grouped = new Set([
    ".lp-menu button", ".vw-seg button", ".dg-mode button", ".dg-tools button", ".rt-seg button", ".cp-mode button",
    ".iq-route button", ".all-f button", ".ar-kinds button", ".teach-scope button", ".set-nav button",
  ]);
  const boxed = new Set(rules.filter(({ sel, declarations }) => /(^|[\s>])button$/.test(sel)
    && declarations.some(({ p, v }) => (p === "border" && resolveValue(v.split(" ")[0]) === "1px")
      || (p === "background" && /^var\(--(?:float|fill|surface)/.test(v)))).map(({ sel }) => sel));
  const hovered = new Set(hovers.filter(({ sel }) => sel.includes("button:hover"))
    .map(({ sel }) => sel.slice(0, sel.indexOf(":hover"))));
  assert.deepEqual([...boxed].filter((selector) => !hovered.has(selector) && !grouped.has(selector)), []);
});

test("Interrupt, Retry and Edit brighten through the hover veil and the primary text colour", () => {
  const selector = ".meta-btn:not(:disabled):hover";
  assert.ok(declares(selector, "background-image", "linear-gradient(var(--hover-fill),var(--hover-fill))"));
  assert.ok(declares(selector, "color", "var(--ink)"));
});
