import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dom } from "./lib/dom.mjs";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";

const rows = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
const value = (selector, property) =>
  rows.find((row) => row.property === property && row.context.at(-1)?.selector === selector)?.value;
assert.equal(value(".m-start", "margin"), "auto 0");
assert.equal(value(".column:has(.m-start,.m-load),.msgs:has(> .m-start,> .m-load)", "flex"), "1 0 auto");
assert.equal(value(".m-load", "place-items"), "center");
assert.equal(value(".m-load", "animation"), "hs-in var(--d-in) var(--ease) var(--d-wait) both");
assert.equal(value(".spin.is-load", "mask"), "var(--mask-load)");
const { document } = await dom('<div class="msgs"><div class="m-start"></div><div class="m"></div></div>');
const margin = rows.filter((row) => row.property?.startsWith("margin") &&
  row.context.at(-1)?.selector?.startsWith(":root:not([data-msgx]) .msgs>"));
const start = document.querySelector(".m-start"), msg = document.querySelector(".m");
assert.ok(margin.some((rule) => msg.matches(rule.context.at(-1).selector)));
assert.ok(margin.every((rule) => !start.matches(rule.context.at(-1).selector)));
