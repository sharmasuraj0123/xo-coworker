// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

test("a ticked select ends its chosen row with a check, with no dot before the words", async () => {
  const { window, document } = await dom("<main></main>");
  const { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node } = window;
  Object.assign(globalThis, { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node });
  Object.assign(globalThis, { innerHeight: 844, innerWidth: 1440 });
  const { defineXoSelect } = await import("../components/xo-select.js");
  defineXoSelect();
  const host = document.querySelector("main");
  assert.ok(host);
  const select = document.createElement("xo-select");
  select.dataset.mark = "check";
  select.innerHTML = '<option value="day" selected data-icon="sun">Every day</option><option value="once">Once</option>';
  host.append(select);
  const button = select.querySelector("button");
  button?.focus();
  button?.click();
  try {
    const menu = host.querySelector(".dd-menu");
    assert.equal(menu?.classList.contains("is-check"), true);
    const rows = [...host.querySelectorAll(".dd-row")];
    assert.equal(rows.length, 2);
    assert.equal(host.querySelectorAll(".dd-mk, .dd-dot").length, 0, "no dot");
    assert.equal(rows.map((r) => r.lastElementChild?.className).join(), "dd-ck,dd-ck", "the tick's place at each row's end");
    assert.equal(Boolean(rows[0].querySelector(".dd-ck svg")), true, "the choice ticked");
    assert.equal(Boolean(rows[1].querySelector(".dd-ck svg")), false);
  } finally {
    button?.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key: "Escape" }));
  }
  assert.equal(button?.getAttribute("aria-expanded"), "false", "closed before linkedom's observer sees its own rows");
});
