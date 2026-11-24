// The panel takes its frames' parts from the panel.frame place: each entry's mount gets its frame's body, and Changes' counts and theme are its entry's.
import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";

const { document, window } = await dom('<aside class="side"></aside>'
  + '<div id="main"><button id="opener">Open panel</button><section id="independent"></section></div>');
let phone = false;
const phoneQuery = document.createElement("span");
Object.defineProperty(phoneQuery, "matches", { get: () => phone });
function trackListeners(target, type) {
  const listeners = new Set();
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = (name, listener, options) => {
    if (name === type) listeners.add(listener);
    add(name, listener, options);
  };
  target.removeEventListener = (name, listener, options) => {
    if (name === type) listeners.delete(listener);
    remove(name, listener, options);
  };
  return listeners;
}
const mediaListeners = trackListeners(phoneQuery, "change");
const resizeListeners = trackListeners(window, "resize");
globalThis.matchMedia = (query) => query.includes("max-width") ? phoneQuery : { matches: false };
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.innerWidth = 1440;
const sidebar = document.querySelector(".side");
sidebar.getBoundingClientRect = () => ({ width: 250 });
const observed = new Set();
globalThis.ResizeObserver = class {
  observe(target) { observed.add(target); this.target = target; }
  disconnect() { observed.delete(this.target); }
};
const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { createStage } = await import("../panel/panel.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const mounted = {}, themes = [];
const map = { mount: () => {}, agents: () => [], mode: "graph", setMode() {}, show() {}, hide() {} };
K.places.contribute("panel.frame", { id: "map", title: "Map", mount: (host) => { mounted.map = host.id; }, api: map }, "t");
K.places.contribute("panel.frame", { id: "changes", title: "Changes", mount: (host, o) => { mounted.changes = [host.className, typeof o.openFile, typeof o.view]; return { paint: () => false, head: () => null, wide: false }; }, counts: () => "", theme: (t) => themes.push(t) }, "t");
let view = "home";
const S = createStage({ files: { changes: () => [] }, viewer: {}, view: () => view, go() {}, announce() {}, at: () => ({}), places: K.places });
assert.equal(mounted.map, "fr-body-map", "the Map's entry mounts into the Map frame's body");
assert.deepEqual(mounted.changes, ["cx-host", "function", "function"], "Changes' entry mounts into its host, with the panel's openFile and view");
S.theme("light");
assert.deepEqual(themes, ["light"], "the theme goes to the Changes entry");
assert.equal(document.querySelector('[data-fr="launch"]'), null, "no Launchpad entry leaves no frame");

const opener = document.querySelector("#opener");
const independent = document.querySelector("#independent");
independent.inert = true;
globalThis.innerWidth = 400;
phone = true;
view = "p:demo";
opener.focus();
S.open();
assert.equal(opener.inert, true);
document.body.append(opener);
S.close();
assert.equal(opener.inert, false, "the panel releases nodes reparented while it covers the page");
assert.equal(independent.inert, true, "the panel preserves inert set by a separate owner");
assert.ok(document.activeElement === opener);
assert.ok(observed.has(sidebar), "Stage tracks the sidebar's occupied width");
assert.equal(mediaListeners.size, 1);
assert.equal(resizeListeners.size, 1);

phone = false;
globalThis.innerWidth = 1440;
S.open();
const stage = document.getElementById("stage");
const grip = stage.querySelector(".stg-grip");
stage.getBoundingClientRect = () => ({ right: globalThis.innerWidth });
const capture = new Set();
grip.setPointerCapture = (id) => capture.add(id);
grip.hasPointerCapture = (id) => capture.has(id);
grip.releasePointerCapture = (id) => capture.delete(id);
const pointer = (type, pointerId, clientX) => grip.dispatchEvent(Object.assign(
  new window.Event(type, { cancelable: true }), { pointerId, clientX, button: 0 },
));
const width = () => document.documentElement.style.getPropertyValue("--sw");
pointer("pointerdown", 1, 900);
pointer("pointermove", 1, 940);
assert.equal(width(), "500px", "the live drag resizes the Stage");
pointer("pointerup", 1, 940);
assert.equal(storage.get("xo-stage-w2"), "500", "the completed drag saves the width");
assert.equal(capture.size, 0, "the completed drag releases its capture");
pointer("pointerdown", 2, 850);
pointer("pointermove", 2, 890);
assert.equal(width(), "550px");
assert.equal(capture.has(2), true, "Stage holds the active pointer capture");
assert.equal(document.body.classList.contains("stage-sizing"), true);
S.disposeLayout();
assert.equal(observed.size, 0, "Stage disposes its sidebar-width observer");
assert.equal(mediaListeners.size, 0, "Stage removes its media-query listener");
assert.equal(resizeListeners.size, 0, "Stage removes its window resize listener");
assert.equal(capture.size, 0, "disposing during drag releases pointer capture");
assert.equal(document.body.classList.contains("stage-sizing"), false, "disposing during drag clears the sizing state");
pointer("pointermove", 2, 950);
pointer("pointerup", 2, 950);
assert.equal(width(), "550px", "events on the retired drag cannot resize the Stage");
assert.equal(storage.get("xo-stage-w2"), "500", "disposing a drag leaves the stored width alone");
const arrow = new window.Event("keydown", { cancelable: true });
Object.assign(arrow, { key: "ArrowLeft" });
assert.equal(grip.dispatchEvent(arrow), true, "the retained grip no longer handles resize keys");
assert.equal(width(), "550px");
console.log("ok panel frames: from the panel.frame place");
