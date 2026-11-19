// Two conversations on screen (the main chat and the panel's thread page, P1): each has its own follower, so
// following, reading and the row held in one never move the other. The main one keeps the old exports.
//   node tests/follow-instance.test.mjs
import assert from "node:assert/strict";
globalThis.matchMedia = () => ({ matches: false });
globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
globalThis.document = { getElementById: () => null };
const { createFollow, initFollow, toLatest, isPinned } = await import("../js/follow.js");

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
// destroy takes its listener away
B.destroy(); assert.equal(b.scroller.ls.length, 0);
// the main one: the old exports, its own instance
assert.equal(typeof initFollow, "function"); assert.equal(typeof toLatest, "function"); assert.equal(isPinned(), true);
console.log("follow-instance: ok");
