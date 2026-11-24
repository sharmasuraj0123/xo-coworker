// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
import { declarationsFor, resolveValue, stylesheetRows, tokenValuesFor } from "./lib/css-snapshot.mjs";

const compact = ":root[data-msgx] .m-turn";
const pill = compact + " .turn>.tb>.tb-h";
const rail = compact + " .tb-work.is-open .tb-rail>.tb>.tb-h";
const railRow = compact + " .tb-work.is-open .tb-rail .tb-rows>.tb-row>.tb-rh";
const openRow = compact + " .turn>.tb.tb-act.is-unfolded>.tb-rows>.tb-row>.tb-rh";

/** @param {string} selector @param {string} property @param {string} [media] */
function value(selector, property, media) {
  const rows = declarationsFor((group) => list.comma(group).includes(selector), property);
  const row = rows.find((candidate) => candidate.context.find((scope) => scope.at === "media")?.params === media);
  assert.ok(row, selector + " " + property);
  return row.value;
}

test("the control height scale has three desktop steps", () => {
  const tokens = tokenValuesFor();
  assert.deepEqual(["--h-sm", "--h-ctl", "--h-lg"].map((name) => tokens.get(name)), ["24px", "32px", "40px"]);
});

test("Reply and Copy use the standard control size and the bubbles leave enough space", () => {
  for (const property of ["width", "height"]) assert.equal(value(".mx-acts button", property), "var(--h-ctl)");
  const bubbleWidths = stylesheetRows.filter((row) => ["width", "max-width"].includes(row.property)
    && row.context.some((scope) => scope.selector?.includes("[data-msgx]") || scope.selector?.endsWith(" .bubble")));
  assert.equal(bubbleWidths.filter((row) => row.value.includes("calc(100% - 2 * var(--h-ctl) - 10px)")).length, 4);
  assert.ok(bubbleWidths.every((row) => row.value !== "66px"));
  assert.equal(resolveValue(value(".mx-acts", "gap")), "2px");
  assert.equal(resolveValue(value(".mx-acts", "left")), "calc(100% + 8px)");
});

test("images leave space below for the actions", () => {
  const bubble = ":root[data-msgx] .msgs>.m.mx-nobub";
  assert.equal(value(bubble, "margin-bottom"), "calc(var(--h-ctl) + 26px)");
  assert.equal(resolveValue(value(".mx-nobub .mx-acts.is-foot", "top")), "calc(100% + 6px)");
});

test("the quote dismiss button fits concentrically in the quote", () => {
  for (const property of ["width", "height"]) {
    assert.equal(value(".mx-r-x", property), "var(--h-sm)");
  }
  assert.equal(value(".mx-reply", "height"), "var(--comp-ctl)");
  assert.equal(value(".mx-reply", "padding"), "0 calc((var(--comp-ctl) - var(--h-sm)) / 2) 0 12px");
  for (const selector of [".mx-acts button", ".mx-r-x"]) {
    const sizes = declarationsFor(selector).filter((row) => /^(?:width|height|min-height)$/.test(row.property));
    assert.ok(sizes.every((row) => !/^\d+px$/.test(row.value)));
  }
});

test("the tool pill and rail share control heights at each viewport", () => {
  for (const selector of [pill, rail, railRow, openRow]) {
    assert.equal(value(selector, "min-height"), "var(--h-ctl)");
    assert.equal(resolveValue(value(selector, "min-height", "(max-width:760px)")), "36px");
  }
  assert.equal(resolveValue(value(pill, "padding")), "4px 12px 4px 16px");
  assert.equal(resolveValue(value(pill, "line-height")), "20px");
});

test("the quote stays touchable and message actions require hover", () => {
  const floor = declarationsFor((selector) => selector.includes(".mx-r-x") && selector.includes(":where("), "min-width");
  assert.ok(floor.some((row) => row.context.some((scope) => scope.at === "media")
    && resolveValue(row.value) === "36px"));
  assert.equal(resolveValue(value(".mx-reply", "padding-right", "(max-width:760px)")), "4px");
  assert.equal(value(".mx-acts", "display", "(hover:none)"), "none");
});
