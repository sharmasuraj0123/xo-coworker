import assert from "node:assert/strict";
import { createKernel } from "../core/kernel/index.js";
import { stackLayers } from "../shell/layers.js";
import { MAIN_LAYERS } from "../shell/overlays.js";
import { dom, same } from "./lib/dom.mjs";

const { document } = await dom('<button id="opener">Decide</button>' + MAIN_LAYERS);
globalThis.matchMedia = () => ({ matches: true });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createDecisions } = await import("../modules/decisions/controller.js");
const { createPacing } = await import("../modules/decisions/pacing.js");
const thread = {
  id: "thread", title: "Make a decision", project: "demo", state: "needs_approval",
  asks: [{ id: "request", kind: "permission", title: "Run: npm test", risk: "routine" }],
  checklist: { done: 0, total: 0, items: [] }, messages: [],
};
const events = [];
const D = createDecisions({
  world: { state: { threads: [thread], gone: new Map() }, act: {} },
  P: createPacing(), PROJ: String, announce() {}, render() {}, later: new Set(), waitSince: new Map(),
  onShown: () => events.push("opened"), onGone: () => events.push("closed"),
});
const opener = document.querySelector("#opener");
const panel = document.querySelector("#panel");
opener.focus();
assert.ok(D.open());
const card = panel.querySelector("#card");
assert.ok(card);
same(document.activeElement, card);
D.park();
assert.ok(panel.hidden);
assert.ok(!D.isOpen());
opener.focus();
D.unpark();
assert.ok(D.isOpen());
same(panel.querySelector("#card"), card);
same(document.activeElement, card);
D.park();
opener.focus();
D.close();
same(document.activeElement, opener);
assert.deepEqual(events, ["opened", "closed"]);

const kernel = createKernel();
const action = [];
const layers = stackLayers(kernel.layers, [
  { id: "viewer", open: () => true, close: () => { action.push("viewer"); } },
  { id: "decisions", open: () => true, close: () => { action.push("decisions"); } },
]);
assert.equal(layers.back(), true);
assert.deepEqual(action, ["viewer"]);
layers.undo();
