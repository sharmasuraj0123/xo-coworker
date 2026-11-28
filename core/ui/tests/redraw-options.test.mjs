// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom, settle } from "../../../tests/lib/dom.mjs";

test("a redraw moves a select's choice and options with its markup and keeps the select's own parts", async () => {
  const { window, document } = await dom("<main></main>");
  const { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node } = window;
  Object.assign(globalThis, { customElements, MutationObserver, getComputedStyle, HTMLElement, Element, Node });
  Object.assign(globalThis, { innerHeight: 844, innerWidth: 1440 });
  const { defineXoSelect } = await import("../components/xo-select.js");
  const { redraw } = await import("../redraw.js");
  defineXoSelect();
  const host = document.querySelector("main");
  assert.ok(host);
  const html = (/** @type {string} */ on, /** @type {string[]} */ values) => `<xo-select name="repeat">${values.map((v) =>
    `<option value="${v}"${v === on ? " selected" : ""}>${v}</option>`).join("")}</xo-select>`;
  redraw(host, html("day", ["day", "once"]));
  await settle();
  const select = /** @type {HTMLElement & { value: string }} */ (host.querySelector("xo-select"));
  const button = select.querySelector("button");
  assert.equal(select.value, "day");
  redraw(host, html("once", ["day", "once"]));
  await settle();
  assert.equal(select.value, "once", "the chip shows what was drawn");
  redraw(host, html("week", ["day", "week"]));
  await settle();
  assert.equal(select.value, "week");
  assert.deepEqual([...select.querySelectorAll("option")].map((o) => o.value), ["day", "week"]);
  assert.equal(select.querySelector("button") === button, true, "its button stays");
  assert.equal(select.querySelectorAll(".dd-menu").length, 1);
});
