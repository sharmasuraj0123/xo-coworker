// @ts-check
import assert from "node:assert/strict";
import { publishedRules } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const capped = (/** @type {string} */ sel) => rules.filter((rule) => rule.sel === sel)
  .flatMap((rule) => rule.declarations).filter(({ p }) => p === "max-height").map(({ v }) => v);

assert.deepEqual(capped(".iq-opts"), ["var(--pop-list-h)"], "the picker's lists scroll past their cap");
for (const rule of rules.filter(({ sel }) => sel.startsWith(".iq-opts"))) {
  for (const { p, v } of rule.declarations) {
    if (p === "max-height") assert.notEqual(v, "none", `${rule.sel} keeps the cap, so a long model list stays on screen`);
  }
}
console.log("ok picker-list-cap: a long model list scrolls inside the picker");
