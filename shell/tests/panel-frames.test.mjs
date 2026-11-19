// The panel takes its frames' parts from the panel.frame place: each entry's mount gets its frame's body, and Changes' counts and theme are its entry's.
import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";

await dom(`<div id="main"></div>`);
const g = /** @type {any} */ (globalThis);
g.matchMedia ??= () => ({ matches: false, addEventListener() {}, addListener() {} });
g.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.innerWidth ??= 1440;
g.addEventListener ??= () => {};
const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { createStage } = await import("../panel/panel.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const mounted = {}, themes = [];
const map = { mount: () => {}, agents: () => [], mode: "graph", setMode() {}, show() {}, hide() {} };
K.places.contribute("panel.frame", { id: "map", title: "Map", mount: (host) => { mounted.map = host.id; }, api: map }, "t");
K.places.contribute("panel.frame", { id: "changes", title: "Changes", mount: (host, o) => { mounted.changes = [host.className, typeof o.openFile, typeof o.view]; return { paint: () => false, head: () => null, wide: false }; }, counts: () => "", theme: (t) => themes.push(t) }, "t");
const S = createStage({ files: { changes: () => [] }, viewer: {}, view: () => "home", go() {}, announce() {}, at: () => ({}), icon: () => "", places: K.places });
assert.equal(mounted.map, "fr-body-map", "the Map's entry mounts into the Map frame's body");
assert.deepEqual(mounted.changes, ["cx-host", "function", "function"], "Changes' entry mounts into its host, with the panel's openFile and view");
S.theme("light");
assert.deepEqual(themes, ["light"], "the theme goes to the Changes entry");
assert.equal(document.querySelector('[data-fr="launch"]').hidden, true, "no Launchpad entry: its frame stays away");
console.log("ok panel frames: from the panel.frame place");
