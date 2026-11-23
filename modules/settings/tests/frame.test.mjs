// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createSettingsFrame } from "../frame.js";

const { document } = await dom(`
  <button id="side">Settings</button><button id="phone">Settings</button>
  <section id="settings" hidden>
    <button id="close">Close</button>
    <div class="set-nav">
      <button data-set="general" aria-selected="true">General</button>
      <button data-set="routing">Routing</button>
    </div>
    <div data-page="general">General settings</div>
    <div data-page="routing" hidden>Routing settings</div>
  </section>
  <section id="panel" data-page="files">Files</section>
  <button id="other" data-set="routing" aria-selected="false" tabindex="0">Other tab</button>
`);
/** @type {string[]} */
const pages = [];
const el = document.getElementById("settings");
const side = document.getElementById("side");
createSettingsFrame({
  el, side, phoneButton: document.getElementById("phone"),
  closeButton: document.getElementById("close"),
  onPage: (id) => pages.push(id), beforeOpen() {}, beforeClose() {}, onHidden() {},
  focusIn: (node) => node.focus(), fallback: () => side,
  phone: window.matchMedia("(max-width: 760px)"),
});
side.click();
el.querySelector('[data-set="routing"]').click();
assert.deepEqual(pages, ["routing"]);
assert.equal(el.querySelector('[data-page="general"]').hidden, true);
assert.equal(el.querySelector('[data-page="routing"]').hidden, false);
assert.equal(el.querySelector('[data-set="general"]').getAttribute("aria-selected"), "false");
assert.equal(el.querySelector('[data-set="routing"]').getAttribute("aria-selected"), "true");
assert.equal(document.getElementById("panel").hidden, false);
assert.equal(document.getElementById("other").getAttribute("aria-selected"), "false");
