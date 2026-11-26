// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";

test("shell startup owns its viewport listener, subscription and animation sync", async () => {
  const { document, window } = await dom(
    '<button id="side-fold"></button><button id="side-jump"><span data-search-icon></span></button><button id="ic-more"></button>'
    + '<button id="nv-more"><span class="nr-chev"></span></button>',
  );
  const viewport = document.createElement("span");
  const animation = { animationName: "dot-turn", startTime: 9 };
  Object.assign(document, { getAnimations: () => [animation] });
  Object.assign(globalThis, { MutationObserver: window.MutationObserver });
  const { startShell } = await import("../start.js");
  const subscriptions = new Set();
  const calls = [];
  const options = {
    THEME: { get: () => "light" }, applyTheme() {}, SIDE: { folded: false, fold() {} },
    PHONE: viewport, setDrawer: (open) => calls.push(open), render: () => calls.push("render"),
    schedule: () => calls.push("schedule"), follow() {}, loadDraft() {},
    world: { subscribe(callback) { subscriptions.add(callback); return () => { subscriptions.delete(callback); }; } },
  };
  async function addDots() {
    const dots = document.createElement("span");
    dots.className = "dots";
    document.body.append(dots);
    await Promise.resolve();
  }
  const resize = () => viewport.dispatchEvent(new window.Event("change"));
  const signalWorld = () => { for (const callback of subscriptions) callback(); };

  const dispose = startShell(options);
  assert.equal(animation.startTime, 0, "startup synchronizes existing working dots");
  resize();
  signalWorld();
  animation.startTime = 9;
  await addDots();
  assert.equal(animation.startTime, 0, "the mounted shell synchronizes new working dots");
  assert.deepEqual(calls, ["render", false, "render", "schedule"]);

  dispose();
  resize();
  signalWorld();
  animation.startTime = 9;
  await addDots();
  assert.equal(animation.startTime, 9, "a retired shell ignores new working dots");
  assert.deepEqual(calls, ["render", false, "render", "schedule"]);
  assert.equal(subscriptions.size, 0);

  const failed = new Error("startup render failed");
  assert.throws(() => startShell({ ...options, render() { throw failed; } }), (error) => error === failed);
  resize();
  signalWorld();
  animation.startTime = 9;
  await addDots();
  assert.equal(animation.startTime, 9, "a failed start disconnects its animation observer");
  assert.deepEqual(calls, ["render", false, "render", "schedule"]);
  assert.equal(subscriptions.size, 0);
});
