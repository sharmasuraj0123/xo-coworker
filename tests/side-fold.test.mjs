// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ACTIONS, binding } from "../core/platform/keys.js";
import { appDocument } from "../tools/conformance/templates.mjs";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("the docked desktop canvas uses a shared inset and corner radius", () => {
  const canvas = ".app:not(.side-folded) > .main";
  assert.deepEqual(valuesFor(canvas, "margin"), ["8px 8px 8px 0"]);
  assert.deepEqual(valuesFor(canvas, "border-radius"), ["16px"]);
});

test("the rail has fold, search and More controls with accessible icon labels", () => {
  const markup = appDocument(fileURLToPath(new URL("../", import.meta.url)));
  for (const id of ["side-fold", "side-jump", "nv-more", "side-more"]) assert.ok(markup.getElementById(id), id);
  assert.equal(markup.querySelector(".side-foot #theme"), null);
  const settings = markup.querySelector('#set-side.gear.is-ic[aria-label="Settings"]');
  assert.ok(settings);
  assert.ok(!settings.querySelector(".gear-t"), "the folded Settings control has no visible label");
});

test("the sidebar fold has a dedicated shortcut", () => {
  assert.equal(ACTIONS.find((action) => action.id === "sideFold")?.def, "mod+b");
  assert.equal(binding("sideFold"), "mod+b");
  assert.deepEqual(ACTIONS.filter((action) => action.def === "mod+b").map((action) => action.id), ["sideFold"]);
});

test("folding gives the desktop canvas the full width and peeking reveals the sheet", () => {
  assert.deepEqual(valuesFor(".side-folded > .side", "width"), ["256px"]);
  assert.deepEqual(valuesFor(".app.side-folded", "grid-template-columns"), ["0 minmax(0,1fr)"]);
  assert.deepEqual(valuesFor(".side-folded > .side", "visibility"), ["hidden"]);
  assert.deepEqual(valuesFor(".side-folded.side-peeking > .side", "visibility"), ["visible"]);
});
