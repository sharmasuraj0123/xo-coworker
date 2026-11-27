// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

test("a day chooser shows its month from Monday, keeps past days out and chooses like an input", async () => {
  const { window, document } = await dom("<main></main>");
  const { customElements, HTMLButtonElement, HTMLElement, Element, Node, Event } = window;
  Object.assign(globalThis, { customElements, HTMLButtonElement, HTMLElement, Element, Node, Event, innerHeight: 844, innerWidth: 1440 });
  const { defineXoDate } = await import("../components/xo-date.js");
  defineXoDate();
  const host = document.createElement("div");
  host.innerHTML = '<xo-date name="date" value="2026-11-28" min="2026-11-27" aria-label="Date"></xo-date>';
  document.querySelector("main")?.append(host);
  const date = /** @type {HTMLElement & { value: string }} */ (host.firstElementChild);
  const button = date.querySelector("button");
  assert.ok(button);
  assert.match(button.textContent ?? "", /28/);
  let changes = 0;
  date.addEventListener("change", () => changes++);
  const press = (/** @type {string} */ key) => button.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true }), { key }));
  button.focus();
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "true");
  const heads = [...date.querySelectorAll('[role="columnheader"]')].map((h) => h.getAttribute("aria-label"));
  assert.equal(heads[0], "Monday");
  assert.equal(date.querySelectorAll("[data-day]").length, 30);
  assert.equal(date.querySelector('[aria-selected="true"]')?.getAttribute("data-day"), "2026-11-28");
  assert.equal(date.querySelector('[data-day="2026-11-26"]')?.getAttribute("aria-disabled"), "true");
  assert.equal(date.querySelector('[data-step="-1"]')?.hasAttribute("disabled"), true, "no month before the first day it allows");
  /** @type {HTMLElement | null} */ (date.querySelector('[data-day="2026-11-26"]'))?.click();
  assert.equal(date.value, "2026-11-28");
  press("ArrowDown");
  assert.equal(button.getAttribute("aria-activedescendant")?.endsWith("2026-12-05"), true);
  press("Enter");
  assert.equal(date.value, "2026-12-05");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(changes, 1);
  assert.equal(document.activeElement === button, true);
  host.remove();
});
