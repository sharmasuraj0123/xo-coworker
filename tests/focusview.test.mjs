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
t("partly in view: brought whole, the least distance (what focus draws is never cut by its scroller's edge)", () => {
  const P = standIn(580); F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
  assert.deepEqual(P.calls, [{ dx: 0, dy: 16 }], "its foot (616) to the box's foot (600)");
});
t("in view, visually hidden (1 px), or no longer focused: left alone", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  for (const [top, o, why] of [[100, {}, "in view"], [-500, { size: 1 }, "1 px (sr-only)"]]) {
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
t("a press's own focus isn't checked; a script's is, whatever led to it, and so is a Tab's (its label's ring, C115)", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  const P = standIn(-972); F.keepFocusInView(P.doc, P.win);
  P.focus(); P.flush();
  assert.equal(P.calls.length, 1, "a Tab's (or a script's) focus out of view: checked, and brought in");
  P.scroller.scrollTop = 2000;
  P.L.pointerdown({ target: P.el }); P.focus(); P.flush();
  assert.equal(P.calls.length, 1, "the control pressed takes focus: the pointer is on it, not checked");
  P.win.tick(200); P.L.pointerdown({ target: { other: true } }); P.focus(); P.flush();
  assert.equal(P.calls.length, 2, "a press on Close, then a script hands focus to the editor out of sight: checked (S138 on a phone)");
  const Q = standIn(100); F.keepFocusInView(Q.doc, Q.win); Q.focus(); Q.flush();
  assert.equal(Q.calls.length, 0, "in view, ring and all: checked, nothing moves");
});
t("a checkbox inside its label is seen as the label: the label must be on screen (C115 on a phone)", () => {
  assert.equal(typeof F.seen, "function", "seen(el)");
  const P = standIn(800, { size: 16 }); // the native box: in its 600 px scroller? no: at 800, but its label reaches further
  const label = { getClientRects: () => [1], getBoundingClientRect: () => ({ top: 560, bottom: 596 + 40, left: 16, right: 200, width: 184, height: 76 }), parentElement: P.scroller, ownerDocument: P.doc };
  P.el.matches = (sel) => sel.includes('input[type="checkbox"]');
  P.el.closest = (sel) => (sel === "label" ? label : null);
  assert.equal(F.seen(P.el), label);
  assert.equal(F.inSight(P.el, P.win), false, "the label's foot (636) is under the scroller's (600): not wholly in sight");
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
// the ring has room (the create-project grader on 65e84b7, S111/S112: brought flush with its scroller's foot, the
// ring's 2 px past its 2 px gap was cut off): a control is brought in with its scroll-margin (base.css: the ring's
// room) clear of the edge, as the browser's own scrollIntoView keeps it; above or below
t("a control is brought in with its ring's room (its scroll-margin) clear of the scroller's edge", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  for (const [top, want, why] of [[1400, 2000 + (1400 + 36 - 600) + 6, "below: its foot 6 px above the box's foot"], [-972, 2000 - 972 - 6, "above: its top 6 px below the box's top"]]) {
    const P = standIn(top);
    const cs = P.win.getComputedStyle;
    P.win.getComputedStyle = (n) => (n === P.el ? { ...cs(n), scrollMarginTop: "6px", scrollMarginRight: "6px", scrollMarginBottom: "6px", scrollMarginLeft: "6px" } : cs(n));
    F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
    assert.equal(P.scroller.scrollTop, want, why);
  }
  assert.equal(typeof F.bringWhole, "function");
  const Q = standIn(580); // partly in view, its foot under the box's: a redraw's bringWhole brings it whole, with room
  const cq = Q.win.getComputedStyle;
  Q.win.getComputedStyle = (n) => (n === Q.el ? { ...cq(n), scrollMarginTop: "6px", scrollMarginBottom: "6px" } : cq(n));
  F.bringWhole(Q.el, Q.win);
  assert.equal(Q.scroller.scrollTop, 2000 + (580 + 36 - 600) + 6, "whole, its foot 6 px above the box's foot");
});
// what focus draws, whoever draws it (the create-project grader on e55c2d8, C115 on a phone: the allow/deny label flush
// with the screen's foot, its ring, 2 px at a 1 px gap, 3 px cut): a checkbox's label that draws the ring is measured
// with the ring, and brought in until it's whole, by a Tab's focus as by a script's
t("a label that draws its checkbox's ring is brought in with the ring whole (C115), by a Tab's focus too", () => {
  assert.equal(typeof F.decoration, "function", "decoration(el)");
  const P = standIn(580, { size: 13 }); // the native box, 13 px, its foot at 593 in a 600 px box
  const label = { nodeType: 1, getClientRects: () => [1], getBoundingClientRect: () => ({ top: 568, bottom: 600, left: 10, right: 200, width: 190, height: 32 }), parentElement: P.scroller, ownerDocument: P.doc, closest: () => null };
  P.el.nodeType = 1; P.el.parentElement = label;
  P.el.matches = (sel) => sel.includes('input[type="checkbox"]');
  P.el.closest = (sel) => (sel === "label" ? label : null);
  const cs = P.win.getComputedStyle;
  P.win.getComputedStyle = (n) => (n === label ? { ...cs(n), outlineStyle: "solid", outlineWidth: "2px", outlineOffset: "1px" } : n === P.el ? { ...cs(n), outlineStyle: "none", outlineWidth: "0px" } : cs(n));
  const d = F.decoration(P.el, P.win);
  assert.equal(d.bottom, 603, "the label's foot (600) and its ring's 3 px");
  F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
  assert.deepEqual(P.calls, [{ dx: 0, dy: 3 }], "brought up 3 px: the ring whole");
});
t("a checkbox and its label both drawing a ring: the label's ring is the one measured whole (every ring counts)", () => {
  const P = standIn(580, { size: 13 });
  const label = { nodeType: 1, getClientRects: () => [1], getBoundingClientRect: () => ({ top: 568, bottom: 600, left: 10, right: 200, width: 190, height: 32 }), parentElement: P.scroller, ownerDocument: P.doc, closest: () => null };
  P.el.nodeType = 1; P.el.parentElement = label;
  P.el.matches = (sel) => sel.includes('input[type="checkbox"]');
  P.el.closest = (sel) => (sel === "label" ? label : null);
  const cs = P.win.getComputedStyle;
  P.win.getComputedStyle = (n) => (n === label ? { ...cs(n), outlineStyle: "solid", outlineWidth: "2px", outlineOffset: "1px" } : n === P.el ? { ...cs(n), outlineStyle: "solid", outlineWidth: "2px", outlineOffset: "2px" } : cs(n));
  assert.equal(F.decoration(P.el, P.win).bottom, 603, "the label's foot and its ring's 3 px, though the box draws one too");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
