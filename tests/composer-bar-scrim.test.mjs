// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, tokenValuesFor } from "./lib/css-snapshot.mjs";

test("light keeps items clear above the composer; dark fades them under it", () => {
  assert.equal(tokenValuesFor(":root").get("--cbar-clear"), "0px");
  assert.equal(tokenValuesFor(':root[data-theme="light"]').get("--cbar-clear"), "var(--cbar-fade)");
  const bars = declarationsFor((selector) => /(^|\s)\.cbar$/.test(selector), "background")
    .map((row) => row.value).filter((value) => value !== "none");
  assert.equal(bars.length, 3);
  for (const bar of bars) assert.ok(bar.startsWith("linear-gradient(to bottom,transparent var(--cbar-clear),"), bar);
});
