// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

const markup = '<button id="nv-shells"><span class="sh-n"></span></button><aside id="shd"></aside>';
const { document, window } = await dom(markup);
globalThis.matchMedia = (query) => Object.assign(new EventTarget(), { matches: query.includes("max-width") });
globalThis.getSelection = () => null;
globalThis.innerHeight = 800;
globalThis.fetch = async (url) => String(url).endsWith("/status")
  ? Response.json({ enabled: true }) : Response.json({ terminals: [] });
const { createShells } = await import("../dock.js");
const root = document.getElementById("shd");
Object.defineProperty(root, "offsetTop", { value: 0 });
const scheduled = new Map();
const set = globalThis.setTimeout;
const clear = globalThis.clearTimeout;
globalThis.setTimeout = (callback, delay, ...args) => {
  if (delay !== 200 && delay !== 180) return set(callback, delay, ...args);
  const id = Symbol();
  scheduled.set(id, () => { scheduled.delete(id); callback(...args); });
  return id;
};
globalThis.clearTimeout = (id) => { if (typeof id === "symbol") scheduled.delete(id); else clear(id); };

const flush = () => new Promise(setImmediate);
let gestures = 0;
document.addEventListener("xo:gesture", () => gestures++);
const dock = createShells();
try {
  await flush();
  document.getElementById("nv-shells").click();
  await flush();
  const bar = root.querySelector(".shd-bar");
  function swipe() {
    const touch = { identifier: 1, clientX: 20, clientY: 30 };
    for (const [type, y, time] of [["touchstart", 30, 20], ["touchmove", 135, 50], ["touchend", 160, 60]]) {
      touch.clientY = y;
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === "touchend" ? [] : [touch] },
        changedTouches: { value: [touch] },
        timeStamp: { value: time },
      });
      bar.dispatchEvent(event);
    }
  }
  swipe();
  assert.equal(scheduled.size, 1, "the live phone dock schedules the glide");
  assert.match(root.style.transition, /200ms/);
  assert.equal(gestures, 0);
  scheduled.values().next().value();
  await flush();
  assert.equal(gestures, 1, "the live gesture emits after the glide");

  swipe();
  assert.equal(scheduled.size, 1);
  assert.match(root.style.transition, /180ms/);
  dock.dispose();
  const pending = scheduled.size;
  for (const fire of scheduled.values()) fire();
  await flush();
  assert.equal(pending, 0, "disposing the dock cancels its pending glide timer");
  assert.equal(gestures, 1, "disposing during a glide suppresses the global settlement event");
  assert.equal(root.style.transform, "");
} finally {
  dock.dispose();
  globalThis.setTimeout = set;
  globalThis.clearTimeout = clear;
}
