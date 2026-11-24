import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";

const rows = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
const value = (selector, property, media) => rows.find((row) => row.property === property &&
  row.context.at(-1)?.selector === selector && row.context.find(({ at }) => at === "media")?.params === media)?.value;
for (const property of ["width", "height"]) {
  assert.equal(value(".mx-acts button", property), "var(--h-ctl)");
  assert.equal(value(".mx-r-x", property), "var(--h-sm)");
}
assert.equal(value(".mx-reply", "height"), "var(--comp-ctl)");
assert.equal(value(".mx-reply", "padding"), "0 calc((var(--comp-ctl) - var(--h-sm)) / 2) 0 12px");
assert.equal(value(":root[data-msgx] .msgs>.m.mx-nobub", "margin-bottom"), "calc(var(--h-ctl) + 26px)");
assert.equal(value(".mx-nobub .mx-acts.is-foot", "top"), "calc(100% + 6px)");
assert.equal(value(".mx-reply", "padding-right", "(max-width:760px)"), "4px");
assert.equal(value(".mx-acts", "display", "(hover:none)"), "none");

const pill = ":root[data-msgx] .m-turn .turn>.tb>.tb-h";
const header = ":root[data-msgx] .m-turn .tb-work.is-open .tb-rail>.tb>.tb-h";
const rowsOpen = ":root[data-msgx] .m-turn .tb-work.is-open .tb-rail .tb-rows>.tb-row>.tb-rh";
const rowsUnfolded = ":root[data-msgx] .m-turn .turn>.tb.tb-act.is-unfolded>.tb-rows>.tb-row>.tb-rh";
for (const selector of [pill, header, rowsOpen, rowsUnfolded]) {
  assert.equal(value(selector, "min-height"), "var(--h-ctl)");
  assert.ok(rows.some((row) => row.property === "min-height" && row.value === "var(--h-touch)" &&
    row.context.at(-1)?.selector?.split(/,\s*/).includes(selector) &&
    row.context.some(({ at, params }) => at === "media" && params === "(max-width:760px)")), selector);
}
assert.equal(value(pill, "padding"), "4px 12px 4px 16px");
assert.equal(value(pill, "line-height"), "var(--lh-ui)");
