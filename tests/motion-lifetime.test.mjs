// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../core/kernel/scope.js";
import { dom, settle } from "./lib/dom.mjs";

test("motion waits use their owner while reduced motion keeps reading windows intact", async () => {
  await dom("");
  const media = { matches: true };
  Object.assign(globalThis, { matchMedia: () => media });
  const { wait, hold } = await import("../core/ui/motion.js");
  const scheduled = new Map();
  let next = 0;
  const scope = createScope({ timers: {
    setTimeout(callback, ms) { const id = ++next; scheduled.set(id, { callback, ms }); return id; },
    clearTimeout(id) { scheduled.delete(id); },
    setInterval, clearInterval,
  } });
  const waiting = wait(140, scope);
  const holding = hold(140, scope);
  assert.deepEqual([...scheduled.values()].map(({ ms }) => ms), [0, 140]);
  scope.dispose();
  await Promise.all([waiting, holding]);
  assert.equal(scheduled.size, 0);
  assert.equal(scope.size, 0);
  media.matches = false;
});

test("expansion callbacks are cancelled on reversal and permanent pagehide for both layouts", async () => {
  const { document, window } = await dom('<section><div id="box"><div id="body" hidden></div></div></section>');
  const { expand } = await import("../core/ui/motion.js");
  const callbacks = new Map();
  let next = 0;
  Object.assign(globalThis, {
    requestAnimationFrame(callback) { callbacks.set(++next, callback); return next; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
  });
  const box = document.querySelector("#box");
  const body = document.querySelector("#body");
  const frame = box.parentElement;
  for (const element of [frame, body]) {
    element.animate = () => ({});
    element.getBoundingClientRect = () => ({ height: body.hidden ? 0 : 40 });
  }
  const pagehide = (persisted) => window.dispatchEvent(Object.assign(new window.Event("pagehide"), { persisted }));
  for (const container of [null, frame]) {
    body.hidden = true;
    const called = [];
    expand(box, body, true, { frame: container, onStep: () => called.push("opening") });
    assert.equal(callbacks.size, 1);
    expand(box, body, false, { frame: container, onStep: () => called.push("closing") });
    assert.equal(callbacks.size, 1);
    pagehide(true);
    const [[id, callback]] = callbacks.entries();
    callbacks.delete(id);
    callback();
    assert.deepEqual(called, ["closing"]);
    assert.equal(callbacks.size, 1);
    pagehide(false);
    assert.equal(callbacks.size, 0);
  }
});

test("image fade reports an unexpected decode failure and accepts an encoding failure", async (t) => {
  const { document } = await dom("<img><img>");
  const { fadeImage } = await import("../core/ui/motion.js");
  const failure = new Error("decoder failed");
  const failures = [];
  const reportError = globalThis.reportError;
  globalThis.reportError = (error) => failures.push(error);
  t.after(() => { globalThis.reportError = reportError; });
  for (const [i, img] of [...document.querySelectorAll("img")].entries()) {
    img.decode = async () => { throw i ? new DOMException("encoding failed", "EncodingError") : failure; };
    fadeImage(img);
    img.dispatchEvent(new Event("load"));
  }
  await settle();
  assert.deepEqual(failures, [failure]);
  assert.ok([...document.querySelectorAll("img")].every((img) => !img.style.opacity));
});
