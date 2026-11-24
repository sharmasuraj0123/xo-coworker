// @ts-check

import assert from "node:assert/strict";
import { mock } from "node:test";
import { afterPause } from "../after-pause.js";

const events = new EventTarget();
/** @type {FrameRequestCallback[]} */
const frames = [];
const armed = new Set();
Object.assign(globalThis, {
  addEventListener: (/** @type {string} */ type, /** @type {EventListener} */ listener, /** @type {AddEventListenerOptions} */ options) => {
    armed.add(type);
    events.addEventListener(type, listener, options);
  },
  removeEventListener: (/** @type {string} */ type, /** @type {EventListener} */ listener, /** @type {EventListenerOptions} */ options) => {
    armed.delete(type);
    events.removeEventListener(type, listener, options);
  },
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ callback) => frames.push(callback),
});
Object.defineProperty(globalThis, "performance", { value: { now: () => Date.now() } });

mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
try {
  let calls = 0;
  afterPause(() => { calls++; });
  assert.deepEqual([...armed], ["keydown", "pointerdown", "wheel", "touchstart"]);
  mock.timers.tick(80);
  assert.equal(calls, 0, "work waits until the frame has painted");
  events.dispatchEvent(new Event("wheel"));
  for (const frame of frames.splice(0)) frame(performance.now());
  mock.timers.tick(119);
  assert.equal(calls, 0, "input resets the quiet interval");
  mock.timers.tick(1);
  assert.equal(calls, 1);
  assert.equal(armed.size, 0, "temporary listeners are removed");
} finally {
  mock.timers.reset();
}
