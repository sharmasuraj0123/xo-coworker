// node core/platform/tests/gestures.test.mjs: drag locks one axis after 10 px, claims the touch, follows it and settles with its speed.
import assert from "node:assert/strict";

const docL = {};
globalThis.matchMedia = /** @type {any} */ (() => ({ matches: false }));
globalThis.document = /** @type {any} */ ({ addEventListener: (t, f) => { docL[t] = f; }, dispatchEvent: () => true });
globalThis.getSelection = /** @type {any} */ (() => null);
globalThis.CustomEvent ??= /** @type {any} */ (class { constructor(t) { this.type = t; } });
const G = await import("../gestures.js");

const el = () => { const h = {}; return { h, addEventListener: (t, f) => { h[t] = f; } }; };
const touch = (x, y, id = 1) => ({ identifier: id, clientX: x, clientY: y });
const ev = (touches, ts, extra = {}) => ({ touches, changedTouches: touches, timeStamp: ts, cancelable: true, prevented: false, preventDefault() { this.prevented = true; }, target: {}, ...extra });
let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log("  ok  " + name); };

await t("a sideways drag past 10 px locks, is followed, and ends with its distance and speed", async () => {
  const e = el(), log = [];
  G.drag(/** @type {any} */ (e), { axis: "x", move: (dx, dy) => log.push(["move", dx, dy]), end: (dx, dy, vx) => log.push(["end", dx, dy, Math.round(vx * 100) / 100]) });
  docL.touchstart({ touches: [touch(0, 0)] });
  e.h.touchstart(ev([touch(100, 100)], 0));
  const small = ev([touch(105, 102)], 10);
  e.h.touchmove(small);
  assert.equal(small.prevented, false, "under 10 px nothing is decided");
  const m = ev([touch(140, 104)], 50);
  e.h.touchmove(m);
  assert.equal(m.prevented, true, "locked: the browser's scroll is stopped");
  e.h.touchend(ev([touch(160, 104)], 70));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(log, [["move", 40, 4], ["end", 60, 4, 0.86]]);
});
await t("a drag along the other axis, or one refused by accept, is left to the browser", () => {
  const e = el(), log = [];
  G.drag(/** @type {any} */ (e), { axis: "x", move: () => log.push("move"), end: () => log.push("end") });
  e.h.touchstart(ev([touch(0, 0)], 0));
  const m = ev([touch(5, 40)], 10);
  e.h.touchmove(m);
  assert.equal(m.prevented, false);
  const e2 = el();
  G.drag(/** @type {any} */ (e2), { axis: "y", accept: (_dx, dy) => dy < 0, move: () => log.push("move"), end: () => log.push("end") });
  e2.h.touchstart(ev([touch(0, 0)], 0));
  e2.h.touchmove(ev([touch(0, 30)], 10));
  e2.h.touchend(ev([touch(0, 40)], 20));
  assert.deepEqual(log, []);
});
await t("one touch, one gesture: a second drag on the same touch stays out", () => {
  const outer = el(), inner = el(), log = [];
  G.drag(/** @type {any} */ (inner), { axis: "x", move: () => log.push("inner"), end: () => {} });
  G.drag(/** @type {any} */ (outer), { axis: "x", move: () => log.push("outer"), end: () => {} });
  docL.touchstart({ touches: [touch(0, 0)] });
  for (const x of [inner, outer]) x.h.touchstart(ev([touch(0, 0)], 0));
  for (const x of [inner, outer]) x.h.touchmove(ev([touch(30, 0)], 10));
  assert.deepEqual(log, ["inner"]);
});
await t("a second finger cancels a locked drag", () => {
  const e = el(), log = [];
  G.drag(/** @type {any} */ (e), { axis: "x", move: () => {}, end: () => log.push("end"), cancel: () => log.push("cancel") });
  docL.touchstart({ touches: [touch(0, 0)] });
  e.h.touchstart(ev([touch(0, 0)], 0));
  e.h.touchmove(ev([touch(30, 0)], 10));
  e.h.touchmove(ev([touch(40, 0), touch(5, 5, 2)], 20));
  assert.deepEqual(log, ["cancel"]);
});
await t("glide, follow and unstyle set and clear the inline motion", async () => {
  const s = { style: { transition: "", transform: "", opacity: "" } };
  G.follow(/** @type {any} */ (s), "translateX(4px)", 0.5);
  assert.deepEqual(s.style, { transition: "none", transform: "translateX(4px)", opacity: "0.5" });
  await G.glide(/** @type {any} */ (s), "none", { ms: 5 });
  assert.match(s.style.transition, /^transform 5ms cubic-bezier/);
  G.unstyle(/** @type {any} */ (s), null);
  assert.deepEqual(s.style, { transition: "", transform: "", opacity: "" });
});
console.log(`\n${passed} passed`);
