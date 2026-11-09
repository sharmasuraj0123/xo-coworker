// Focus is never somewhere you can't see it (the create-project/Launchpad grader on c055e74, S023: Settings › Keyboard's
// Reset all put focus on the first shortcut 972 px above the screen, desktop, 1097 on a phone). js/focusview.js runs
// here on stand-in elements: a focused element wholly out of the box it scrolls in is brought in (nearest); one in
// view, a 1 px hidden one, or one that lost focus before the check is left; a Tab's or a press's isn't checked.
//   node tests/focusview.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let F = {};
try { F = await import("../js/focusview.js"); } catch (e) { console.error("  (no js/focusview.js: " + e.code + ")"); }
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// a page: body > scroller (a 600 px tall box at the top, scrolling) > the element at some top
function standIn(top, { size = 36, scrolls = true } = {}) {
  const raf = [], L = {}, calls = [];
  const doc = { body: {}, documentElement: {}, addEventListener: (t, f) => (L[t] = f), activeElement: null };
  const box = { top: 0, left: 0, bottom: 600, right: 390 };
  const scroller = { parentElement: doc.body, ownerDocument: doc, scrollHeight: scrolls ? 3000 : 600, clientHeight: 600, scrollWidth: 390, clientWidth: 390, getBoundingClientRect: () => box, scrollTop: 2000, scrollLeft: 0, own: false, closest: (sel) => (sel === "[data-own-scroll]" && scroller.own ? scroller : null) };
  const el = { parentElement: scroller, ownerDocument: doc, getClientRects: () => [1], getBoundingClientRect: () => ({ top, bottom: top + size, left: 16, right: 16 + Math.max(size, 1), width: Math.max(size, 1), height: size }), dispatchEvent: (ev) => calls.push(ev.detail) };
  let now = 1000;
  const win = { addEventListener: (t, f) => (L["win:" + t] = f), innerHeight: 844, innerWidth: 390, CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o.detail; } }, performance: { now: () => now }, tick: (ms) => (now += ms), requestAnimationFrame: (f) => raf.push(f), getComputedStyle: (n) => (n === scroller ? { overflowY: "auto", overflowX: "hidden" } : { overflowY: "visible", overflowX: "visible", clip: n.clip || "auto" }) };
  return { doc, win, el, scroller, calls, L, focus() { doc.activeElement = el; L.focusin({ target: el }); }, flush() { while (raf.length) raf.shift()(); } };
}

t("a focused element wholly out of its scroller is brought in: that scroller only, the least distance", () => {
  assert.equal(typeof F.keepFocusInView, "function", "js/focusview.js keepFocusInView(doc, win)");
  const P = standIn(-972); // Reset all's first shortcut, above the box
  F.keepFocusInView(P.doc, P.win);
  P.focus(); P.flush();
  assert.deepEqual(P.calls, [{ dx: 0, dy: -972 }], "it says so (focusbrought)");
  assert.equal(P.scroller.scrollTop, 2000 - 972, "its top comes to the box's top");
  const Q = standIn(1400); // below it
  F.keepFocusInView(Q.doc, Q.win); Q.focus(); Q.flush();
  assert.equal(Q.scroller.scrollTop, 2000 + (1400 + 36 - 600), "its foot comes to the box's foot");
});
t("a scroller that owns its scroll (the conversation's, follow.js) is left to its owner", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  const P = standIn(-972); P.scroller.own = true;
  F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
  assert.deepEqual([P.calls.length, P.scroller.scrollTop], [0, 2000]);
});
t("in view, partly in view, visually hidden (1 px), or no longer focused: left alone", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  for (const [top, o, why] of [[100, {}, "in view"], [580, {}, "partly in view"], [-500, { size: 1 }, "1 px (sr-only)"]]) {
    const P = standIn(top, o); F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
    assert.equal(P.calls.length, 0, why);
  }
  // .sr-only on a phone: the 36 px floor makes it 1 × 36, and it's clipped: still hidden, still left
  const S = standIn(-500); S.el.getBoundingClientRect = () => ({ top: -500, bottom: -464, left: 16, right: 17, width: 1, height: 36 }); S.el.clip = "rect(0px, 0px, 0px, 0px)";
  F.keepFocusInView(S.doc, S.win); S.focus(); S.flush();
  assert.equal(S.calls.length, 0, "1 × 36, clipped (a phone's .sr-only button)");
  const P = standIn(-972); F.keepFocusInView(P.doc, P.win); P.focus(); P.doc.activeElement = null; P.flush();
  assert.equal(P.calls.length, 0, "focus moved on before the check");
});
t("out of view is judged against the box it scrolls in; with none, nothing moves", () => {
  assert.equal(typeof F.lost, "function");
  const P = standIn(700, { scrolls: true });
  assert.equal(F.lost(P.el, P.win), true, "below its 600 px scroller, though on the 844 px screen");
  const Q = standIn(-972, { scrolls: false });
  assert.equal(F.lost(Q.el, Q.win), false, "no box to scroll (a box with nothing to scroll isn't one): nothing it can do, nothing moves");
});
t("the browser's own focus isn't checked (a Tab no script took over, the control pressed); a script's is, even after a press (S138)", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  const P = standIn(-972); F.keepFocusInView(P.doc, P.win);
  P.L["win:keydown"]({ key: "Tab", defaultPrevented: false }); P.focus(); P.flush();
  assert.equal(P.calls.length, 0, "a Tab's own move: the browser's");
  P.win.tick(200); P.L["win:keydown"]({ key: "Tab", defaultPrevented: true }); P.focus(); P.flush();
  assert.equal(P.calls.length, 1, "Tab taken over by a script (a sheet's wrap): the script's focus is checked");
  P.win.tick(200); P.L.pointerdown({ target: P.el }); P.focus(); P.flush();
  assert.equal(P.calls.length, 1, "the control pressed takes focus: the browser's");
  P.win.tick(200); P.L.pointerdown({ target: { other: true } }); P.focus(); P.flush();
  assert.equal(P.calls.length, 2, "a press on Close, then a script hands focus to the editor out of sight: checked (S138 on a phone)");
  P.win.tick(200); P.L.keydown && P.L.keydown({ key: "Enter" }); P.focus(); P.flush();
  assert.equal(P.calls.length, 3, "Enter, then a script's focus: checked");
});
t("content that grows above the control under the keyboard: it was in sight, so its scroller brings it back (C115)", () => {
  assert.equal(typeof F.inSight, "function", "inSight");
  const P = standIn(560); // its foot at 596, in a 600 px box
  assert.equal(F.inSight(P.el, P.win), true);
  P.el.getBoundingClientRect = () => ({ top: 640, bottom: 676, left: 16, right: 52, width: 36, height: 36 }); // a refusal said above it
  assert.equal(F.inSight(P.el, P.win), false);
  F.bringWhole(P.el, P.win);
  assert.equal(P.scroller.scrollTop, 2000 + 76, "the least distance: its foot to the box's foot");
  const red = readFileSync(new URL("../js/redraw.js", import.meta.url), "utf8");
  assert.ok(/const seen = !!focus && el\.contains\(focus\) && inSight\(focus\);\s*const changed = syncChildren\(el, tpl\.content, focus\);\s*if \(changed && seen && focus\.isConnected && !inSight\(focus\)\) bringWhole\(focus\);/.test(red), "redraw keeps it: in sight before, so in sight after");
});
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
t("the app starts it once", () => {
  assert.match(app, /import \{ keepFocusInView \} from "\.\/focusview\.js";/);
  assert.equal((app.match(/\bkeepFocusInView\(\)/g) || []).length, 1);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
