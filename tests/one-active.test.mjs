// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
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
