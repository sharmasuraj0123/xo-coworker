// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

test("a select closes when held, preserves focus and refuses a new choice", async () => {
  const { window, document } = await dom("<main></main>");
  Object.assign(globalThis, {
    customElements: window.customElements,
    MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle,
    innerHeight: 844,
    innerWidth: 1440,
  });
  const { defineXoSelect } = await import("../components/xo-select.js");
  defineXoSelect();
  const select = document.createElement("xo-select");
  select.innerHTML = '<option value="a">Alpha</option><option value="b">Bravo</option>';
  document.querySelector("main").append(select);
  const button = select.querySelector("button");
  let changes = 0;
  select.addEventListener("change", () => changes++);
  for (const attr of ["aria-busy", "aria-disabled"]) {
    button.focus();
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "true");
    const last = select.querySelectorAll('[role="option"]')[1];
    select.setAttribute(attr, "true");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(button.getAttribute(attr), "true");
    assert.equal(button.disabled, false);
    assert.equal(document.activeElement, button);
    last.click();
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(select.value, "a");
    assert.equal(changes, 0);
    select.removeAttribute(attr);
    assert.equal(button.hasAttribute(attr), false);
  }
  select.remove();
});
