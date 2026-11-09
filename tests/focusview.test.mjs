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
  const scroller = { parentElement: doc.body, ownerDocument: doc, scrollHeight: scrolls ? 3000 : 600, clientHeight: 600, scrollWidth: 390, clientWidth: 390, getBoundingClientRect: () => box, style: "auto" };
  const el = { parentElement: scroller, ownerDocument: doc, getClientRects: () => [1], getBoundingClientRect: () => ({ top, bottom: top + size, left: 16, right: 16 + Math.max(size, 1), width: Math.max(size, 1), height: size }), scrollIntoView: (o) => calls.push(o) };
  let now = 1000;
  const win = { innerHeight: 844, innerWidth: 390, performance: { now: () => now }, tick: (ms) => (now += ms), requestAnimationFrame: (f) => raf.push(f), getComputedStyle: (n) => (n === scroller ? { overflowY: "auto", overflowX: "hidden" } : { overflowY: "visible", overflowX: "visible" }) };
  return { doc, win, el, calls, L, focus() { doc.activeElement = el; L.focusin({ target: el }); }, flush() { while (raf.length) raf.shift()(); } };
}

t("a focused element wholly out of its scroller is brought in, the least distance", () => {
  assert.equal(typeof F.keepFocusInView, "function", "js/focusview.js keepFocusInView(doc, win)");
  const P = standIn(-972); // Reset all's first shortcut, above the box
  F.keepFocusInView(P.doc, P.win);
  P.focus(); P.flush();
  assert.deepEqual(P.calls, [{ block: "nearest", inline: "nearest" }]);
  const Q = standIn(1400); // below it
  F.keepFocusInView(Q.doc, Q.win); Q.focus(); Q.flush();
  assert.equal(Q.calls.length, 1);
});
t("in view, partly in view, visually hidden (1 px), or no longer focused: left alone", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  for (const [top, o, why] of [[100, {}, "in view"], [580, {}, "partly in view"], [-500, { size: 1 }, "1 px (sr-only)"]]) {
    const P = standIn(top, o); F.keepFocusInView(P.doc, P.win); P.focus(); P.flush();
    assert.equal(P.calls.length, 0, why);
  }
  const P = standIn(-972); F.keepFocusInView(P.doc, P.win); P.focus(); P.doc.activeElement = null; P.flush();
  assert.equal(P.calls.length, 0, "focus moved on before the check");
});
t("out of view is judged against the box it scrolls in, else the window", () => {
  assert.equal(typeof F.lost, "function");
  const P = standIn(700, { scrolls: true });
  assert.equal(F.lost(P.el, P.win), true, "below its 600 px scroller, though on the 844 px screen");
  const Q = standIn(700, { scrolls: false });
  assert.equal(F.lost(Q.el, Q.win), false, "a box with nothing to scroll isn't its scroller: the window is, and 700 is on it");
});
t("focus the browser moves itself (a Tab, a press) isn't checked: only a script's", () => {
  assert.equal(typeof F.keepFocusInView, "function");
  const P = standIn(-972); F.keepFocusInView(P.doc, P.win);
  P.L.keydown({ key: "Tab" }); P.focus(); P.flush();
  assert.equal(P.calls.length, 0, "a Tab's focus: the browser's own");
  P.win.tick(200); P.L.pointerdown({}); P.focus(); P.flush();
  assert.equal(P.calls.length, 0, "a press's focus");
  P.win.tick(200); P.L.keydown({ key: "Enter" }); P.focus(); P.flush();
  assert.equal(P.calls.length, 1, "Enter on Reset all, then the script's focus: checked");
});
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
t("the app starts it once", () => {
  assert.match(app, /import \{ keepFocusInView \} from "\.\/focusview\.js";/);
  assert.equal((app.match(/\bkeepFocusInView\(\)/g) || []).length, 1);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
