// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

const { window, document } = await dom("<main></main>");
const { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node } = window;
Object.assign(globalThis, { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node, innerHeight: 844, innerWidth: 1440 });
const { defineXoSelect } = await import("../components/xo-select.js");
defineXoSelect();

test("a ticked select ends its chosen row with a check, with no dot before the words", async () => {
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

test("a runtime's mark stands before its name, in the list and on the button", async () => {
  const select = document.createElement("xo-select");
  select.innerHTML = '<option value="">Default</option><option value="codex" data-agm="openai" selected>Codex</option>';
  document.querySelector("main")?.append(select);
  const button = select.querySelector("button");
  assert.equal(button?.firstElementChild?.className, "agm agm-openai dd-ic", "on the button");
  button?.click();
  try {
    const rows = [...select.querySelectorAll(".dd-row")];
    assert.equal(rows[1].querySelector(".agm-openai") !== null, true, "in its row");
    assert.equal(rows[0].querySelector(".agm") === null, true);
  } finally {
    button?.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key: "Escape" }));
  }
});
