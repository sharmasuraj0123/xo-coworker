// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { bootPage } from "./lib/page.mjs";

const { document } = await bootPage();

test("Artifacts carries no count", () => {
  const row = document.querySelector("#nv-arts");
  assert.ok(row);
  assert.deepEqual([...row.children].map((el) => el.className), ["nr-ic", "nr-name"]);
});
