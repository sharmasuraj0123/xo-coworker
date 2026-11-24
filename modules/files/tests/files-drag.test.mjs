// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { wireFileDrag } from "../drag.js";

const { document, window } = await dom(`<main class="fl-list"><div class="fl-g">
  <button class="fl-r" data-fl-file="docs/notes.md" draggable="true"></button>
  <button class="fl-r is-dir" data-fl-dir="docs" draggable="true"></button>
  <button class="fl-r is-dir" data-fl-dir="docs/sub"></button>
  <button class="fl-r is-dir" data-fl-dir="archive"></button>
</div></main>`);
const list = document.querySelector("main");
const file = list.querySelector("[data-fl-file]");
const docs = list.querySelector('[data-fl-dir="docs"]');
const sub = list.querySelector('[data-fl-dir="docs/sub"]');
const archive = list.querySelector('[data-fl-dir="archive"]');
const moves = [];
/** @type {string | null} */
let scopeKey = "project-a";
const stopDrag = wireFileDrag(list, () => scopeKey, (row) => row.dataset.flFile ?? row.dataset.flDir ?? null, (path) => path.split("/").pop() || "", (from, to) => moves.push([from, to]));
const transfer = { effectAllowed: "", dropEffect: "", setData() {} };
function fire(/** @type {HTMLElement} */ target, /** @type {string} */ type) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = transfer;
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

fire(file, "dragstart");
assert.equal(fire(archive, "dragover"), true);
assert.equal(archive.classList.contains("is-drop"), true);
assert.equal(fire(archive, "drop"), true);
assert.equal(archive.classList.contains("is-drop"), false);
fire(archive, "drop");
fire(file, "dragstart");
assert.equal(fire(docs, "dragover"), false);
assert.equal(fire(docs, "drop"), false);
fire(docs, "dragstart");
assert.equal(fire(sub, "drop"), false);
scopeKey = "";
fire(file, "dragstart");
scopeKey = "project-b";
assert.equal(fire(archive, "drop"), false);
scopeKey = null;
fire(file, "dragstart");
assert.equal(fire(archive, "drop"), false);
assert.deepEqual(moves, [["docs/notes.md", "archive/notes.md"]]);
scopeKey = "project-a";
fire(file, "dragstart");
fire(archive, "dragover");
stopDrag();
assert.equal(archive.classList.contains("is-drop"), false);
assert.equal(fire(archive, "drop"), false);
