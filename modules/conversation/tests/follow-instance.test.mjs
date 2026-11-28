// @ts-check

// Two conversations on screen each have their own follower; the main one keeps the old exports.

import assert from "node:assert/strict";
globalThis.matchMedia = () => ({ matches: false });
const observers = [];
const failure = new Error("Cannot observe the scroller");
let failTarget;
globalThis.ResizeObserver = class {
  targets = new Set();
  constructor() { observers.push(this); }
  observe(target) {
    if (target === failTarget) throw failure;
    this.targets.add(target);
  }
  disconnect() { this.targets.clear(); }
};
globalThis.document = { getElementById: () => null };
const { createFollow, initFollow, toLatest, isPinned } = await import("../follow.js");

const scroller = (h = 2000) => { const s = { scrollTop: 0, scrollHeight: h, clientHeight: 500, ls: [], addEventListener(t, f) { this.ls.push(f); }, removeEventListener(t, f) { this.ls = this.ls.filter((x) => x !== f); }, scrollTo({ top }) { this.scrollTop = Math.min(top, this.scrollHeight - this.clientHeight); this.ls.forEach((f) => f()); }, getBoundingClientRect: () => ({ top: 0, bottom: 500 }), contains: () => true }; return s; };
const column = { clientWidth: 600 };
const msgs = { children: [] };
const a = { scroller: scroller(), column, msgs }, b = { scroller: scroller(), column, msgs };
const A = createFollow(a), B = createFollow(b);
A.init(); B.init();
A.toLatest(); B.toLatest();
assert.equal(a.scroller.scrollTop, 1500); assert.ok(A.isPinned() && B.isPinned());
// reading up in one leaves the other pinned
a.scroller.scrollTop = 800; a.scroller.ls.forEach((f) => f());
assert.equal(A.isPinned(), false);
assert.equal(B.isPinned(), true, "the other conversation still follows");
B.unpin(null);
assert.equal(B.isPinned(), false);
A.toLatest();
assert.ok(A.isPinned() && !B.isPinned());
B.destroy();
assert.equal(b.scroller.ls.length, 0, "destroy removes the retained scroller listener");
assert.equal(observers[1].targets.size, 0, "destroy disconnects both observed nodes");

const first = { scroller: scroller(), column, msgs };
const next = { scroller: scroller(), column, msgs };
let current = first;
const repeated = createFollow({ scroller: () => current.scroller, column, msgs });
repeated.init();
const firstObserver = observers.at(-1);
current = next;
repeated.init();
assert.equal(first.scroller.ls.length, 0, "reinit removes the first scroller listener");
assert.equal(firstObserver.targets.size, 0, "reinit disconnects the first observer");
assert.equal(next.scroller.ls.length, 1, "reinit binds the replacement scroller once");
repeated.destroy();
assert.equal(next.scroller.ls.length, 0);

const retrying = createFollow(first);
failTarget = first.scroller;
assert.throws(() => retrying.init(), (error) => error === failure);
assert.equal(first.scroller.ls.length, 0, "failed init rolls back the scroller listener");
assert.equal(observers.at(-1).targets.size, 0, "failed init rolls back the partially started observer");
failTarget = undefined;
retrying.init();
assert.equal(first.scroller.ls.length, 1, "init can retry after rollback");
retrying.destroy();
A.destroy();
// the main one: the old exports, its own instance
assert.equal(typeof initFollow, "function"); assert.equal(typeof toLatest, "function"); assert.equal(isPinned(), true);
console.log("follow-instance: ok");
