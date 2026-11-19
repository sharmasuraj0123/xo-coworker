// @ts-check

// The Intelligence chip toggles its own popover: pressed again it closes, whichever composer's chip opened it.
import assert from "node:assert/strict";
import { dom, settle } from "./lib/dom.mjs";


const { window, document } = await dom(`<div id="iq-pop" tabindex="-1" hidden></div><button id="iq"></button><button id="tiq"></button><p id="elsewhere">x</p>`);
const g = /** @type {any} */ (globalThis);
g.MutationObserver = window.MutationObserver;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.localStorage = g.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.location = new URL("http://127.0.0.1/");
g.fetch = () => new Promise(() => {});
g.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

const { createIntel } = await import("../js/intel.js");
const thread = { id: "cmsg_1", chatId: "chat_demo", project: "demo", title: "Tidy", runtime: "claude_code", sessionId: "cse_1", intelligence: {} };
const world = {
  state: { router: null, policy: null, chatPolicy: {}, runtimes: [], threads: [thread] },
  project: () => ({ id: "chat_demo" }), thread: (id) => (id === "cmsg_1" ? thread : null),
  act: { coordinatorAgent: () => null, policyFor: () => null, setPolicy() {}, refresh() {}, fetchThread() {} },
  subscribe() { return () => {}; },
};
const IQ = createIntel({ world, PROJ: (p) => p, onChange() {}, record() {}, onMoved() {} });
const $ = (s) => document.querySelector(s);
const press = (el) => el.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
// each chip's own click handler, as app.js wires them
const chip = (el, s) => el.addEventListener("click", () => { if (IQ.isOpen) IQ.close(); else IQ.open(s, el); });
chip($("#iq"), "p:demo"); chip($("#tiq"), "t:cmsg_1");
const tap = (el) => { press(el); el.dispatchEvent(new window.Event("click", { bubbles: true })); };

for (const [id, s] of [["#iq", "p:demo"], ["#tiq", "t:cmsg_1"]]) {
  IQ.open(s, $(id)); await settle();
  assert.equal(IQ.isOpen, true, `${id} opens it`);
  assert.equal($(id).getAttribute("aria-expanded"), "true");
  tap($(id)); await settle();
  assert.equal(IQ.isOpen, false, `${id} pressed again closes it`);
  assert.equal($(id).getAttribute("aria-expanded"), "false");
  IQ.open(s, $(id)); await settle();
  press($("#elsewhere"));
  assert.equal(IQ.isOpen, false, `a press elsewhere closes what ${id} opened`);
}

console.log("intel-chip-toggle: ok");
process.exit(0);
