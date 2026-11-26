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

test("More wears the ⋯ glyph, not a dashboard", async () => {
  const { drawSidebarControls } = await import("../shell/frame-icons.js");
  drawSidebarControls();
  assert.equal(document.querySelector("#ic-more svg")?.getAttribute("data-xi"), "more");
});
