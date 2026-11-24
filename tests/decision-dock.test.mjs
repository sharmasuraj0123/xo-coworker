import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom(`
  <section id="region" tabindex="-1"><div id="dock"></div></section>
  <aside id="panel"><div id="pn-stage"></div><div id="pn-foot"></div><div id="pn-rail"></div><button id="pn-x"></button></aside>
`);
Object.assign(globalThis, {
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  ResizeObserver: class { observe() {} disconnect() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
});
const { createDecisions } = await import("../js/decide.js");
const { createPacing } = await import("../modules/decisions/pacing.js");
const { createDock } = await import("../modules/decisions/dock.js");
const { READ_MS } = await import("../modules/decisions/kit.js");
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
const root = document.querySelector("#dock");
const region = document.querySelector("#region");
const D = createDecisions({
  world, P: createPacing(), PROJ: (p) => p, announce() {}, render() {}, back() {}, later: new Set(), waitSince: new Map(),
  onUndone: (key) => { if (dock.TD.undone?.key === key) dock.TD.undone.end(); },
});
const dock = createDock({ el: root, view: () => "t:thread", region: () => region }, {
  CH: { isChats: () => false }, D, S: { dockFold: {} }, world,
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
press("[data-fold]");
assert.ok(document.activeElement === region, "folding hands focus to the conversation");
press("[data-unfold]");
assert.ok(document.activeElement === root.querySelector(".card"), "unfolding hands focus to the card");

now += READ_MS;
press('[data-act="allow"]');
await Promise.resolve();
const undo = root.querySelector("[data-dock-undo]");
assert.ok(undo);
assert.ok(document.activeElement === undo, "the decision receipt receives focus");
assert.deepEqual(calls, []);
press("[data-dock-undo]");
await Promise.resolve();
await Promise.resolve();
assert.ok(root.querySelector('[data-act="allow"]'));
assert.ok(document.activeElement === root.querySelector(".card"), "Undo returns focus to the restored decision");
assert.deepEqual(calls, [], "Undo cancels the decision before delivery");
