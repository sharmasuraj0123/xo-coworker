// @ts-check
import assert from "node:assert/strict";
import { cmp, context, decls, rules, spec } from "../../tests/lib/cascade.mjs";

const css = rules(new URL("../../tests/lib/cascade.mjs", import.meta.url));
const selectors = new Set([
  ":root:root .conv:has(.tw-menu) #top",
  ":root:root .conv:has(.tw-menu,.ckbar.is-open) :is(.top,.thead)",
]);
/** @param {number} width */
function menuStack(width) {
  return css.filter((rule) => selectors.has(rule.sel) && context(rule, width).active)
    .flatMap((rule) => decls(rule.d).filter(({ p }) => p === "z-index").map(({ v }) => ({ rule, v })))
    .sort((a, b) => cmp(spec(a.rule.sel), spec(b.rule.sel)) || a.rule.n - b.rule.n)
    .map(({ v }) => v);
}
assert.deepEqual(menuStack(390), ["6", "7"], "a thread menu stacks above the checklist and its own header");
assert.deepEqual(menuStack(1440), [], "the stacking overrides are limited to the phone layout");
