// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createViewerHead } from "../modules/files/viewer-head.js";
import { resolveValue, stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

test("the narrow file header keeps a 36px state control and a 16px spinner", () => {
  const state = ".vw-top .vw-more:is(.is-done,.is-busy)";
  const spinner = ".vw-top .vw-more.is-busy .spin";
  const expected = [
    [state + " span", "display", "none"],
    [state, "width", "36px"],
    [state, "padding", "0"],
    [spinner, "width", "16px"],
    [spinner, "height", "16px"],
  ];
  for (const [selector, property, value] of expected) {
    const rows = stylesheetRows.filter((row) => row.property === property
      && row.context.at(-1)?.selector === selector
      && row.context.some((scope) => scope.at === "container" && scope.params === "vwtop (max-width:360px)"));
    assert.deepEqual(rows.map((row) => resolveValue(row.value)), [value], selector + " " + property);
  }
});

test("More keeps an accessible name and a state icon even when the visible label is hidden", async () => {
  const { document } = await dom('<section id="viewer"></section>');
  const el = document.querySelector("#viewer");
  const V = { file: { name: "a.md" } };
  const { head } = createViewerHead({
    V, el, doc: () => null, canSave: () => true, chg: () => null,
    showsDiff: () => false, runsCode: () => false,
  });
  el.innerHTML = head();
  const button = () => el.querySelector("[data-vw-more]");
  assert.equal(button().getAttribute("aria-label"), "More: copy, download");
  assert.equal(button().getAttribute("title"), "Copy, download");

  for (const [kind, word] of [["copy", "Copying…"], ["download", "Downloading…"]]) {
    V.busy = { kind, shown: true };
    el.innerHTML = head();
    assert.equal(button().getAttribute("aria-label"), word);
    assert.equal(button().getAttribute("title"), word);
    assert.equal(button().querySelector(".spin")?.getAttribute("aria-hidden"), "true");
  }
  V.busy = null;
  V.copied = true;
  el.innerHTML = head();
  assert.equal(button().getAttribute("aria-label"), "Copied");
  assert.equal(button().getAttribute("title"), "Copied");
  assert.ok(button().classList.contains("is-done"));
  assert.ok(button().querySelector("svg"));
  assert.ok(!button().querySelector(".spin"), "the finished action has no spinner");
});

test("the busy More control retains the full secondary ink", () => {
  const otherBusy = (selector) => selector.endsWith(':is(.vw-cut-dl,.vw-btn:not(.vw-more))[aria-busy="true"]');
  assert.deepEqual(valuesFor(otherBusy, "opacity"), [".6"]);
  assert.deepEqual(valuesFor(otherBusy, "cursor"), ["progress"]);
  assert.deepEqual(valuesFor(".vw-more.is-busy", "color"), [resolveValue("var(--ink-2)")]);
});
