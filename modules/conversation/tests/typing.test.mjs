// @ts-check

// The line under a conversation: who works on it, what it waits for, and the clock that redraws it when a wait ends.
import { createScope } from "../../../core/kernel/scope.js";
import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";

await dom(`<div id="a"></div><div id="b"></div>`);
const { createTyping } = await import("../typing.js");

const soon = (ms) => new Date(Date.now() + ms).toISOString();
const thread = { id: "cmsg_x", state: "waiting", busy: false, held: { until: soon(600), reason: "limit" }, checklist: { items: [] } };
const coordHeld = { until: soon(300), reason: "limit" };
const world = {
  act: { coordinatorHeld: (chat) => (chat === "demo" ? coordHeld : null), replying: () => false, doing: () => null },
  state: { awaiting: {}, turns: null },
  thread: (id) => (id === "cmsg_x" ? thread : null),
};

let woke = 0;
const scope = createScope();
const T = createTyping({
  world, CH: { working: () => false }, PROJ: (p) => p,
  convThread: (v) => (v.startsWith("t:") ? world.thread(v.slice(2)) : null),
  chatOf: (v) => (v.startsWith("p:") ? v.slice(2) : null),
  isBusy: (t) => t.busy === true, heldWords: (h) => `Waiting for its ${h.reason}`, openAsk: () => null,
  sendingTo: () => null,
  schedule: () => { woke++; }, tick() {},
}, scope);
const A = { typing: document.getElementById("a"), view: "p:demo" };
const B = { typing: document.getElementById("b"), view: "t:cmsg_x" };

// a held coordinator: its words, amber, no clock
assert.equal(T.render(A), true);
assert.equal(A.typing.querySelector(".typing.is-held .ty-t").textContent, "demo coordinator · waiting for its limit");
assert.equal(T.render(A), false, "drawn again with nothing new: no change");
// a held thread: its own words
T.render(B);
assert.equal(B.typing.querySelector(".typing.is-held .ty-t").textContent, "Waiting for its limit");

// each conversation's wait ends on its own clock: drawing one doesn't cancel the other's
await new Promise((r) => setTimeout(r, 800)); await settle();
assert.equal(woke, 2, "both waits redraw when they end");

// working: the line says so, with the current step
thread.held = null; thread.busy = true; thread.checklist.items = [{ state: "doing", text: "Tidying" }];
T.render(B);
assert.equal(B.typing.querySelector(".typing:not(.is-held) .ty-t").textContent, "Working · Tidying");
// nothing to say: the line goes
thread.busy = false;
assert.equal(T.render(B), true);
assert.equal(B.typing.innerHTML, "");

coordHeld.until = soon(1000);
T.render(A);
assert.ok(scope.size > 0);
scope.dispose();
assert.equal(scope.size, 0);
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.equal(woke, 2);
console.log("conv-typing: ok");
process.exit(0);
