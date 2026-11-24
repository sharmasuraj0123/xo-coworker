// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createFilesTree } from "../modules/files/tree.js";
import { dkey } from "../modules/files/folder-reads.js";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

test("quiet control links have a whole, unsqueezed target at desktop and phone widths", () => {
  const link = ".fl-link";
  assert.ok(valuesFor(link, "text-decoration").includes("underline"));
  assert.deepEqual(valuesFor(link, "white-space"), ["nowrap"]);
  assert.deepEqual(valuesFor(link, "flex"), ["none"]);
  assert.deepEqual(valuesFor(link, "display"), ["inline-flex"]);
  const heights = stylesheetRows.filter((row) => row.property === "min-height" && row.context.at(-1)?.selector === link);
  assert.equal(heights.length, 2);
  const [desktop, phone] = heights;
  assert.ok(!desktop.context.some((scope) => scope.at === "media"));
  assert.ok(phone.context.some((scope) => scope.at === "media" && scope.params === "(max-width:760px)"));
  const tokens = tokenValuesFor();
  assert.ok(parseFloat(substitute(desktop.value, tokens)) >= 32);
  assert.ok(parseFloat(substitute(phone.value, tokens)) >= 36);
  for (const selector of [".rn-none .fl-link", ".fl-note .fl-link"]) assert.deepEqual(valuesFor(selector), []);
});

test("Files and Runs status lines can wrap around their controls", () => {
  for (const selector of [".fl-note", ".rn-none"]) assert.ok(valuesFor(selector, "flex-wrap").includes("wrap"), selector);
});

test("the tree renders a retry as a pending status without error styling", async () => {
  const { document } = await dom('<div id="tree"></div>');
  const root = document.querySelector("#tree");
  const place = { key: "repo", project: "repo", base: "", label: "Repo" };
  const dirs = new Map([[dkey(place, ""), { state: "loading", retry: true, v: 1 }]]);
  const tree = createFilesTree({
    F: { q: "", sel: null },
    M: {},
    NW: {},
    dirs,
    setOf: () => new Set(),
    world: { state: { threads: [] } },
    viewer: {},
    placeNew() {},
  });
  tree.paintTree(place, root);
  const status = root.querySelector(".fl-note.is-pending");
  assert.match(status.textContent, /Reading again/);
  assert.equal(status.getAttribute("role"), "status");
  assert.equal(status.classList.contains("is-err"), false);
  assert.equal(status.querySelector(".fl-link").getAttribute("aria-busy"), "true");
});
