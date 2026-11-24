import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { createDockFolds } from "../modules/decisions/dock-folds.js";

const { document } = await dom('<section id="region" tabindex="-1"><div id="dock"></div></section>');
let disconnects = 0;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() { disconnects++; }
};
globalThis.matchMedia = () => ({ matches: true });
const { createDock } = await import("../modules/decisions/dock.js");
const region = document.querySelector("#region"), el = document.querySelector("#dock");
let confirming = true;
const dock = createDock({ el, view: () => "chats", region: () => region }, {
  CH: { isChats: () => true, confirmHtml: () => confirming ? "<button>Send now</button>" : "" },
  D: { isOpen: () => false }, folds: createDockFolds(), world: { state: { gone: new Map() } },
  convThread: () => null, convHost: () => null, dockGestures() {},
});
dock.render([]);
const confirmation = el.firstElementChild;
confirmation.focus();
dock.render([]);
same(el.firstElementChild, confirmation);
dock.reset();
assert.equal(el.childElementCount, 0);
assert.equal(disconnects, 1);
same(document.activeElement, region);
dock.render([]);
assert.equal(el.textContent, "Send now");
confirming = false;
dock.render([]);
assert.equal(el.childElementCount, 0);
