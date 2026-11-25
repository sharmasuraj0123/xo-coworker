// @ts-check

import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
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
const options = {
  el, side, phoneButton: document.getElementById("phone"),
  closeButton: document.getElementById("close"),
  onPage: (id) => pages.push(id), beforeOpen() {}, beforeClose() {}, onHidden() {},
  focusIn: (node) => node.focus(), fallback: () => side,
  phone: window.matchMedia("(max-width: 760px)"),
};
const scope = createScope();
const frame = createSettingsFrame({ ...options, scope });
side.focus();
side.click();
el.querySelector('[data-set="routing"]').click();
assert.deepEqual(pages, ["routing"]);
assert.equal(el.querySelector('[data-page="general"]').hidden, true);
assert.equal(el.querySelector('[data-page="routing"]').hidden, false);
assert.equal(el.querySelector('[data-set="general"]').getAttribute("aria-selected"), "false");
assert.equal(el.querySelector('[data-set="routing"]').getAttribute("aria-selected"), "true");
assert.equal(document.getElementById("panel").hidden, false);
assert.equal(document.getElementById("other").getAttribute("aria-selected"), "false");
el.querySelector('[data-set="routing"]').focus();
frame.dispose();
assert.equal(scope.size, 0);
assert.equal(el.hidden, true);
assert.equal(document.activeElement, side);
side.click();
assert.equal(el.hidden, true);

const shortcut = document.createElement("button");
shortcut.setAttribute("data-set-open", "general");
document.body.append(shortcut);
shortcut.click();
assert.deepEqual(pages, ["routing"]);
const remount = createSettingsFrame(options);
shortcut.click();
assert.deepEqual(pages, ["routing", "general"]);
assert.equal(el.hidden, false);
remount.dispose();
