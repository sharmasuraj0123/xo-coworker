import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { MAIN_LAYERS } from "../shell/overlays.js";

const { document, window } = await dom(MAIN_LAYERS);
globalThis.matchMedia = () => ({ matches: true });
const { createDecisions } = await import("../modules/decisions/controller.js");
const { createPacing } = await import("../modules/decisions/pacing.js");
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const t = { id: "thread", title: "Thread", project: "project", state: "needs_approval",
  asks: [{ id: "ask", kind: "permission", title: "Allow this?", risk: "routine" }],
  checklist: { done: 0, total: 0, items: [] }, messages: [] };
const world = { state: { threads: [t], gone: new Map() }, act: {} };
const D = createDecisions({
  world, P: createPacing(), PROJ: String, announce() {}, render() {}, later: new Set(), waitSince: new Map(),
});
const [need] = D.needItems();
const frame = document.createElement("article");
frame.innerHTML = D.cardHtml(need);
document.body.append(frame);
D.wireCard(frame, frame.firstElementChild, need, { surface: "dock", onStep() {}, after() {} });
const details = frame.querySelector(".dis-h");
const section = details.closest("[data-dis]");
assert.ok(section);
const wrapper = document.createElement("div");
details.before(wrapper);
wrapper.append(details);
details.dispatchEvent(new window.Event("click", { bubbles: true }));
assert.equal(details.getAttribute("aria-expanded"), "true");
assert.ok(!section.querySelector(".dis-b").hidden);
details.dispatchEvent(new window.Event("click", { bubbles: true }));
assert.equal(details.getAttribute("aria-expanded"), "false");
