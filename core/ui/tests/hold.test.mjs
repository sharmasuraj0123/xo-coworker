// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { holdToConfirm } from "../components/hold.js";

test("active holds release their listeners and frames when cancelled, completed or detached", async ({ mock }) => {
  const { document, window } = await dom("<button>Confirm</button>");
  const button = document.querySelector("button");
  const frames = new Map();
  let now = 100, next = 0;
  mock.method(performance, "now", () => now);
  Object.assign(globalThis, {
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const listeners = mock.method(document, "addEventListener");
  const removals = mock.method(document, "removeEventListener");
  const progress = [];
  let confirmations = 0, releases = 0;
  const mounted = holdToConfirm(button, {
    ms: 100,
    ready: () => true,
    onProgress: (value) => progress.push(value),
    onConfirm: () => confirmations++,
    onRelease: () => releases++,
  });
  const press = () => button.dispatchEvent(Object.assign(new window.Event("keydown"), { key: "Enter", repeat: false }));
  const tick = (elapsed) => {
    now += elapsed;
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn(now);
  };

  press();
  assert.equal(frames.size, 1);
  tick(25);
  assert.deepEqual(progress, [0.25]);
  mounted.cancel();
  assert.equal(releases, 1);
  assert.equal(frames.size, 0);

  press();
  tick(100);
  assert.equal(confirmations, 1);
  assert.equal(frames.size, 0);

  press();
  button.remove();
  tick(100);
  assert.equal(confirmations, 1);
  assert.equal(frames.size, 0);
  const visibility = (call) => call.arguments[0] === "visibilitychange";
  const handlers = (tracker) => tracker.mock.calls.filter(visibility).map((call) => call.arguments[1]);
  assert.equal(handlers(listeners).length, 3);
  assert.deepEqual(handlers(removals), handlers(listeners));
});
