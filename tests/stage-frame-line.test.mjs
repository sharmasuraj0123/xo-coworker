// The line between Threads and Changes moves both ways, within limits, while Threads has the room.
import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";

const frame = (id) => `<section class="fr" data-fr="${id}"><button data-fr-fold></button><div class="fr-b"></div></section>`;
const { document, window } = await dom(`<div id="st">${frame("agents")}<div class="fr-gut" data-gut="agents|changes" tabindex="0"></div>${frame("changes")}<div class="fr-gut" data-gut="changes|map"></div>${frame("map")}</div>`);
const { createFrames } = await import("../shell/panel/frames.js");
const FRAME_MIN = 96;

const el = document.getElementById("st");
const S = { stackH: 600, chEmpty: true, open: false };
const fr = { agents: { rows: null, folded: false }, changes: { folded: false, h: 640 }, map: { h: 260, folded: true } };
const { layout } = createFrames({ el, S, fr, frames: () => ["agents", "changes", "map"], view: () => "p:x", map: { show() {}, hide() {} }, persist() {}, paint() {} });
layout();

const changes = el.querySelector('[data-fr="changes"]'), line = el.querySelector('[data-gut="agents|changes"]');
const press = (key, times = 1) => { for (let n = 0; n < times; n++) line.dispatchEvent(Object.assign(new window.Event("keydown"), { key })); };
const height = () => parseFloat(changes.style.height);

assert.equal(el.querySelector('[data-fr="agents"]').classList.contains("is-grow"), true);
assert.equal(changes.style.height, "", "a height an older build saved is not applied");
press("ArrowUp", 4);
const raised = height();
assert.ok(raised > FRAME_MIN, "dragging up gives Changes room");
press("ArrowDown");
assert.ok(height() < raised, "dragging down takes it back");
press("ArrowUp", 60);
assert.equal(height(), 600 - 2 - 4 * 48 - 40, "up stops where Threads keeps its head, filter and two rows above the folded Map");
press("ArrowDown", 60);
assert.equal(height(), FRAME_MIN, "down stops at Changes' least room");
line.dispatchEvent(new window.Event("dblclick"));
assert.equal(changes.style.height, "", "a double-click hands Changes back its own height");

const { declarationsFor } = await import("./lib/css-snapshot.mjs");
const raw = (selector, property) => declarationsFor(selector, property).map((row) => row.value);
assert.deepEqual(raw('.stage .fr.is-grow[data-fr="agents"]', "min-height"), ["calc(4 * var(--s-12))"], "Threads never drops under two rows");
assert.deepEqual(raw('.stage .fr[data-fr="changes"]:not(.is-folded)', "flex-shrink"), ["1"], "a sized Changes gives way first");
console.log("the Threads|Changes line moves both ways within limits");
