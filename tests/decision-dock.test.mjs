import { createScope } from "../core/kernel/scope.js";
import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { MAIN_LAYERS } from "../shell/overlays.js";
import { createKernel } from "../core/kernel/kernel.js";
import { definePlaces } from "../shell/places.js";

const { window, document } = await dom(`
  <header id="top"><button data-dock-open>Open</button></header><section id="region" tabindex="-1"><div id="tdock"></div></section>
  ${MAIN_LAYERS}
`);
Object.assign(globalThis, {
  cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  ResizeObserver: class { observe() {} disconnect() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
});
const { createDecisions } = await import("../modules/decisions/controller.js");
const { createPacing } = await import("../modules/decisions/pacing.js");
const { mountDecisionDock } = await import("../modules/decisions/dock-surface.js");
const kernel = createKernel();
definePlaces(kernel);
const { estLine } = await import("../modules/decisions/rank.js");
const { READ_MS } = await import("../modules/decisions/kit.js");
for (const [total, expected] of [[0, ""], [1, "1 step left in its checklist"], [2, "2 steps left in its checklist"]]) {
  assert.equal(estLine({ t: { checklist: { done: 0, total } } }), expected);
}
let now = 0;
Object.defineProperty(globalThis.performance, "now", { value: () => now });
const thread = {
  id: "thread", title: "Read the README", project: "demo", state: "needs_approval",
  asks: [{ id: "permission", kind: "permission", title: "Run: npm test", risk: "routine" }],
  checklist: { done: 0, total: 0, items: [] }, messages: [],
};
const calls = [];
const world = {
  state: { threads: [thread], gone: new Map() },
  act: { decide: (...args) => { calls.push(args); return Promise.resolve(); } },
};
const root = document.querySelector("#tdock");
const region = document.querySelector("#region");
const D = createDecisions({
  world, P: createPacing(), PROJ: (p) => p, announce() {}, render() {}, back() {}, later: new Set(), waitSince: new Map(),
  onUndone: (key) => kernel.bus.emit("app:decision-undone", key),
});
let renders = 0;
const renderCard = D.cardHtml;
D.cardHtml = (...args) => { renders++; return renderCard(...args); };
const mountScope = createScope();
const { main: dock } = mountDecisionDock({ scope: mountScope, view: () => "t:thread", region: () => region,
  on: kernel.bus.on, announce() {},
  CH: { isChats: () => false }, D, world,
  convThread: () => thread, convHost: () => null, askShort: (need) => need.ask.title,
  schedule() {}, dockGestures() {},
});
const press = (selector) => {
  const button = root.querySelector(selector);
  assert.ok(button, selector);
  button.focus();
  button.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
};

dock.render(D.needItems());
assert.equal(renders, 1);
const title = root.querySelector(".c-h").textContent.trim();
const details = root.querySelector(".dis-h");
assert.equal(details.getAttribute("aria-expanded"), "false");
press(".dis-h");
assert.equal(details.getAttribute("aria-expanded"), "true");
assert.ok(!root.querySelector(".dis-b").hidden);
press("[data-fold]");
assert.equal(renders, 1);
assert.equal(root.querySelector(".df-t").textContent, title);
assert.ok(document.activeElement === region, "folding hands focus to the conversation");
const opener = document.querySelector("[data-dock-open]");
opener.dataset.dockOpen = root.querySelector("[data-unfold]").dataset.unfold;
opener.click();
await new Promise((done) => setTimeout(done, 30));
assert.ok(root.querySelector(".card"), "the header reopens the folded main decision");
assert.ok(document.activeElement === root.querySelector(".card"), "unfolding hands focus to the card");

now += READ_MS;
press('[data-act="allow"]');
await Promise.resolve();
const undo = root.querySelector("[data-dock-undo]");
assert.ok(undo);
const receipt = root.querySelector(".r-done>.hr");
assert.ok(receipt && receipt.classList.contains("has-undo") && undo.classList.contains("hr-undo"), "the receipt is the notice line's pill");
assert.equal(receipt.querySelector(".hr-t")?.textContent, "Allowed.");
assert.equal(root.querySelector(".tp-done"), null);
assert.ok(document.activeElement === undo, "the decision receipt receives focus");
assert.deepEqual(calls, []);
press("[data-dock-undo]");
await Promise.resolve();
await Promise.resolve();
assert.ok(root.querySelector('[data-act="allow"]'));
assert.ok(document.activeElement === root.querySelector(".card"), "Undo returns focus to the restored decision");
assert.deepEqual(calls, [], "Undo cancels the decision before delivery");

assert.ok(D.open());
D.park();
document.querySelector("#card").remove();
D.unpark();
const heading = document.querySelector("#pn-h");
assert.equal(heading.getAttribute("tabindex"), "-1");
same(document.activeElement, heading);
