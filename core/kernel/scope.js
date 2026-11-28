// @ts-check

import { createUndos } from "./undo.js";

/** @typedef {Pick<typeof globalThis, "setTimeout" | "clearTimeout" | "setInterval" | "clearInterval">} Timers */

/** @param {{ timers?: Timers, warn?: import("./types").Warn }} [options] */
export function createScope({ timers = globalThis, warn } = {}) {
  const undos = createUndos(warn);
  const controller = new AbortController();
  const { signal } = controller;

  /** @type {typeof undos.add} */
  function add(cleanup) {
    const undo = undos.add(cleanup);
    if (signal.aborted) undo();
    return undo;
  }

  /** @type {import("./types").ModuleContext["effect"]} */
  function effect(start) {
    return add(signal.aborted ? undefined : start());
  }

  /** @type {import("./types").ModuleContext["timeout"]} */
  function timeout(fn, ms) {
    const undo = effect(() => {
      const timer = timers.setTimeout(() => { undo(); fn(); }, ms);
      return () => timers.clearTimeout(timer);
    });
    return undo;
  }

  /** @param {number} ms @returns {Promise<void>} */
  function delay(ms) {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => timeout(add(resolve), ms));
  }

  /** @type {Pick<import("./types").ModuleContext, "listen" | "interval" | "frame" | "observe">} */
  const resources = {
    listen(target, type, fn, options) {
      return effect(() => {
        const capture = typeof options === "boolean" ? options : options?.capture;
        target.addEventListener(type, fn, options);
        return () => target.removeEventListener(type, fn, capture);
      });
    },
    interval(fn, ms) {
      return effect(() => {
        const timer = timers.setInterval(fn, ms);
        return () => timers.clearInterval(timer);
      });
    },
    frame(fn) {
      if (typeof requestAnimationFrame !== "function") return timeout(() => fn(Date.now()), 16);
      const undo = effect(() => {
        const frame = requestAnimationFrame((time) => { undo(); fn(time); });
        return () => cancelAnimationFrame(frame);
      });
      return undo;
    },
    observe: (observer) => add(() => observer.disconnect()),
  };

  return {
    ...resources, effect, timeout, delay, signal,
    dispose() {
      if (signal.aborted) return;
      controller.abort();
      undos.dispose();
    },
    get size() { return undos.size; },
  };
}
