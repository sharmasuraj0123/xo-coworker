// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { lost, mediaHolds, shrunk } from "./lib/cascade.mjs";
import { stylesheetRows } from "./lib/css-snapshot.mjs";
import { tokens } from "./lib/tokens.mjs";

const root = new URL("./lib/x.mjs", import.meta.url);
const phoneWidth = 390;

const tokenOverrides = stylesheetRows.filter((row) =>
  row.context.length === 3 && row.context[0].params === "tokens" && row.context[1].at === "media"
    && mediaHolds("@media " + row.context[1].params, phoneWidth) && row.context[2].selector === ":root"
    && row.property?.startsWith("--") && /^\d+(?:\.\d+)?px$/.test(row.value));
const phoneTokens = { ...tokens, ...Object.fromEntries(tokenOverrides.map((row) => [row.property, parseFloat(row.value)])) };

test("phone declarations retain priority over desktop declarations at 390px", () => {
  assert.deepEqual(lost(root).filter((loss) => loss.how === "all"), []);
});

test("phone sizes and targets retain their floor in more specific contexts", () => {
  assert.deepEqual(shrunk(root, phoneTokens), []);
});
