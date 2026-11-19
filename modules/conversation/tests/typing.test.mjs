// @ts-check

// The line under a conversation: who works on it, what it waits for, and the clock that redraws it when a wait ends.
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

await dom(`<div id="a"></div><div id="b"></div>`);
const { createTyping } = await import("../typing.js");

const soon = (ms) => new Date(Date.now() + ms).toISOString();
const thread = { id: "cmsg_x", state: "waiting", busy: false, held: { until: soon(80), reason: "limit" }, checklist: { items: [] } };
const coordHeld = { until: soon(40), reason: "limit" };
const world = {
  act: { coordinatorHeld: (chat) => (chat === "demo" ? coordHeld : null), replying: () => false, doing: () => null },
  state: { awaiting: {}, turns: null },
  thread: (id) => (id === "cmsg_x" ? thread : null),
};

const T = createTyping({
  world, CH: { working: () => false }, S: {}, PROJ: (p) => p,
  convThread: (v) => (v.startsWith("t:") ? world.thread(v.slice(2)) : null),
  chatOf: (v) => (v.startsWith("p:") ? v.slice(2) : null),
  isBusy: (t) => t.busy === true, heldWords: (h) => `Waiting for its ${h.reason}`, openAsk: () => null,
  schedule() {}, tick() {},
});
const A = { typing: /** @type {any} */ (document.getElementById("a")), view: "p:demo" };
const B = { typing: /** @type {any} */ (document.getElementById("b")), view: "t:cmsg_x" };

// a held coordinator: its words, amber, no clock
assert.equal(T.render(A), true);
assert.equal(A.typing.querySelector(".typing.is-held .ty-t").textContent, "demo coordinator · waiting for its limit");
assert.equal(T.render(A), false, "drawn again with nothing new: no change");
// a held thread: its own words
T.render(B);
assert.equal(B.typing.querySelector(".typing.is-held .ty-t").textContent, "Waiting for its limit");

// working: the line says so, with the current step
thread.held = null; thread.busy = true; thread.checklist.items = [{ state: "doing", text: "Tidying" }];
T.render(B);
assert.equal(B.typing.querySelector(".typing:not(.is-held) .ty-t").textContent, "Working · Tidying");
// nothing to say: the line goes
thread.busy = false;
assert.equal(T.render(B), true);
assert.equal(B.typing.innerHTML, "");

console.log("conv-typing: ok");
process.exit(0);
