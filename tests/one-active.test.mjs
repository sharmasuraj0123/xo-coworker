// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
import { createKernel } from "../core/kernel/kernel.js";
import { createScope } from "../core/kernel/scope.js";
import { createWorkspaceJump } from "../modules/search/jump-items.js";
import { createJump } from "../modules/search/jump.js";
import { declarationsFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

for (const target of [".at-list", ".jump-list"]) {
  test(target + " does not paint a second active row on hover", () => {
    const duplicate = declarationsFor((selector) => {
      const relevant = selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");
      if (!relevant.includes(target)) return false;
      const parts = list.comma(relevant);
      return parts.some((part) => part.includes(":hover")) && parts.some((part) => part.includes("aria-selected"));
    });
    assert.deepEqual(duplicate, []);
  });
}

test("Jump changes the active descendant and picks the pointed row by keyboard", async () => {
  const { document, window } = await dom('<div hidden><input><ul class="jump-list"></ul></div>');
  const host = document.body.firstElementChild, field = host.querySelector("input"), results = host.querySelector("ul");
  const visited = [];
  const jump = createJump({
    host, field, list: results,
    places: () => ["First", "Second"].map((name) => ({ name, sub: "", icon: "", v: name })),
    actions: () => [], more: () => [], go: (id) => visited.push(id),
    announce() {}, focusIn: (el) => el.focus(), onHidden() {},
  });
  jump.open();
  results.lastElementChild.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
  assert.equal(field.getAttribute("aria-activedescendant"), "j-1");
  assert.deepEqual(Array.from(results.querySelectorAll('[aria-selected="true"]'), (node) => node.id), ["j-1"]);
  const enter = Object.assign(new window.Event("keydown", { bubbles: true, cancelable: true }), { key: "Enter" });
  field.dispatchEvent(enter);
  assert.deepEqual(visited, ["Second"]);
});

test("Jump reconciles contributed results while open and releases its listeners on disposal", async () => {
  const { document, window } = await dom('<div hidden><input><ul></ul></div>');
  const host = document.body.firstElementChild, field = host.querySelector("input"), results = host.querySelector("ul");
  const { places } = createKernel();
  places.define({ id: "search.provider", kind: "list", scope: "app", description: "Jump results." });
  const scope = createScope();
  const noop = () => {};
  const picked = [];
  const jump = createWorkspaceJump({
    host, sources: places, go: noop, announce: noop, focusIn: (el) => el.focus(), onHidden: noop,
    items: {
      D: { needItems: () => [] }, projects: () => [], threadsOf: () => [],
      projectIcon: () => "", glyphOf: () => "", wordOf: () => "",
    },
    actions: {
      create: noop, settings: noop, keys: noop, theme: noop, intelligence: () => false,
      openIntelligence: noop, stage: () => false, toggleStage: noop,
    },
  }, scope);
  jump.open();
  field.value = "example";
  field.dispatchEvent(new window.Event("input"));
  const undo = places.contribute("search.provider", {
    id: "example", items: () => [{ name: "Example file", sub: "", icon: "" }], pick: (item) => picked.push(item.name),
  }, "test.search");
  const retired = results.querySelector('[role="option"]');
  assert.match(retired.textContent, /Example file/);
  undo();
  assert.doesNotMatch(results.textContent, /Example file/);
  retired.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(picked, []);
  const html = results.innerHTML;
  scope.dispose();
  field.value = "workspace";
  field.dispatchEvent(new window.Event("input"));
  assert.equal(results.innerHTML, html);
  assert.equal(scope.size, 0);
});
