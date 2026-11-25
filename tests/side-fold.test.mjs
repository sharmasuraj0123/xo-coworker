// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ACTIONS, binding } from "../core/platform/keys.js";
import { appDocument } from "../tools/conformance/templates.mjs";
import { declarationFiles, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

test("the docked desktop canvas uses a shared inset and corner radius", () => {
  const canvas = ".app:not(.side-folded) > .main";
  assert.deepEqual(valuesFor(canvas, "margin"), ["8px 8px 8px 0"]);
  assert.deepEqual(valuesFor(canvas, "border-radius"), ["16px"]);
});

test("the rail has fold, search and More controls with accessible icon labels", () => {
  const markup = appDocument(fileURLToPath(new URL("../", import.meta.url)));
  for (const id of ["side-fold", "side-jump", "nv-more", "side-more"]) assert.ok(markup.getElementById(id), id);
  assert.ok(markup.querySelector("#theme.gear.is-ic[role=switch]"));
  const settings = markup.querySelector('#set-side.gear.is-ic[aria-label="Settings"]');
  assert.ok(settings);
  assert.ok(!settings.querySelector(".gear-t"), "the folded Settings control has no visible label");
});

test("the sidebar fold has a dedicated shortcut", () => {
  assert.equal(ACTIONS.find((action) => action.id === "sideFold")?.def, "mod+shift+b");
  assert.equal(binding("sideFold"), "mod+shift+b");
  assert.deepEqual(ACTIONS.filter((action) => action.def === "mod+shift+b").map((action) => action.id), ["sideFold"]);
});

test("the folded rail size, motion and colours come from shared tokens", () => {
  assert.equal(tokenValuesFor().get("--side-rail-w"), "calc(var(--h-row) + 2 * var(--s-3))");
  const sidebar = stylesheetRows.filter((row) => declarationFiles.get(row) === "/shell/sidebar.css");
  const starts = sidebar.findIndex((row) => row.context.at(-1)?.selector === ".app" && row.property === "transition"
    && row.value.startsWith("grid-template-columns"));
  assert.ok(starts >= 0);
  assert.ok(sidebar.slice(0, starts).every((row) => !row.context.at(-1)?.selector?.includes("side-folded")));
  const literals = sidebar.slice(starts).filter((row) => {
    const value = row.value.replace(/\b1px solid\b/g, "");
    return /\b\d+(?:\.\d+)?(?:px|rem|ms)\b|#[0-9a-f]{3,8}\b/i.test(value);
  });
  assert.deepEqual(literals, []);
  const row = ":root:root:root .side-folded .prow";
  assert.deepEqual(valuesFor(row, "border-color"), ["transparent"]);
  assert.deepEqual(valuesFor(row, "box-shadow"), ["none"]);
  const icon = ":root:root .side-folded .prow .pr-ic";
  assert.deepEqual(valuesFor(icon, "box-shadow"), ["none"]);
  assert.deepEqual(valuesFor(icon, "animation"), ["none"]);
  assert.ok(valuesFor(".side-pop", "padding").includes("8px"));
  assert.ok(valuesFor(".side-pop", "border-radius").includes("20px"));
});
