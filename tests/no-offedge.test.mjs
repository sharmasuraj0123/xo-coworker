import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";

const rows = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
function value(selector, property, media) {
  return rows.find((row) => row.property === property &&
    row.context.at(-1)?.selector === selector &&
    row.context.find(({ at }) => at === "media")?.params === media)?.value;
}
const rest = ".msgs>.m::after";
assert.ok(value(rest, "content"));
assert.equal(value(rest, "right"), "0");
assert.equal(value(rest, "transform"), undefined);
assert.equal(value(".msgs.mx-pulling>.m::after", "transform"), "translateX(calc((64 - var(--mx-pull,0)) * 1px))");
assert.equal(value(".msgs .bubble", "max-width", "(hover:hover)"), "min(80%,540px,calc(100% - 2 * var(--h-ctl) - 10px))");
const answer = ":root[data-msgx] :is(.m-them>.mb>.prose,.m-turn .turn>.tb-answer,.m-turn .turn>.tb-text)";
assert.equal(value(answer, "max-width", "(hover:hover)"), "min(88%,560px,calc(100% - 2 * var(--h-ctl) - 10px))");
assert.ok(rows.some((row) => row.context.at(-1)?.selector?.endsWith(".has-table") &&
  row.property === "max-width" && row.value === "calc(100% - 2 * var(--h-ctl) - 10px)"));
