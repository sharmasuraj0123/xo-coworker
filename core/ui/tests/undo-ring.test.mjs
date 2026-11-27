import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom("<div id='a'></div>");
const { undoRingHtml, startUndoRings } = await import("../undo-ring.js");

/** @param {Element} root */
function watch(root) {
  const calls = [];
  for (const path of root.querySelectorAll("path")) {
    const running = [];
    path.getAnimations = () => running;
    path.animate = (frames, options) => { calls.push(options); running.push({}); return {}; };
  }
  return calls;
}

test("an Undo ring's markup holds only its fixed deadline and window, so drawing it again changes nothing", () => {
  assert.equal(undoRingHtml(5000, 3000), undoRingHtml(5000, 3000));
  assert.match(undoRingHtml(5000, 3000), /data-ring-until="5000" data-ring-ms="3000"/);
  assert.doesNotMatch(undoRingHtml(5000, 3000), /animation|style=/);
});

test("a ring runs from where its deadline puts it, and once", () => {
  const root = document.querySelector("#a");
  root.innerHTML = undoRingHtml(5000, 3000);
  const calls = watch(root);
  startUndoRings(root, 3000);
  assert.deepEqual(calls, [{ duration: 3000, delay: -1000, easing: "linear", fill: "forwards" }]);
  startUndoRings(root, 3500);
  assert.equal(calls.length, 1, "a redraw that keeps the node never restarts it");
});

test("a ring with no known window empties from when it is first drawn to its deadline", () => {
  const root = document.querySelector("#a");
  root.innerHTML = undoRingHtml(5000);
  const calls = watch(root);
  startUndoRings(root, 4000);
  assert.deepEqual(calls.map((c) => [c.duration, c.delay]), [[1000, 0]]);
});

test("with reduced motion the ring stays still", async () => {
  const was = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  const still = await import("../undo-ring.js?reduced");
  const root = document.querySelector("#a");
  root.innerHTML = still.undoRingHtml(5000, 3000);
  const calls = watch(root);
  still.startUndoRings(root, 3000);
  assert.equal(calls.length, 0);
  globalThis.matchMedia = was;
});
