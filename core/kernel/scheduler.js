// @ts-check
import { createScope } from "./scope.js";

/** @typedef {import("./types").Scheduler} Scheduler */

/** @param {{ request?: (fn: () => void) => unknown, warn?: (...a: unknown[]) => void }} [opts] @returns {Scheduler} */
export function createScheduler(opts = {}) {
  const warn = opts.warn || console.error;
  const scope = createScope({ warn });
  /** @type {(() => void) | undefined} */
  let cancelFrame;
  const request = opts.request
    || (typeof requestAnimationFrame === "function" ? (/** @type {() => void} */ fn) => {
      cancelFrame = scope.frame(fn);
    } : queueMicrotask);
  /** @type {Array<{ key: string, fn: () => void }>} */
  const flushers = [];
  /** @type {Set<string>} */
  const dirty = new Set();
  let all = false, pending = false;

  function flushNow() {
    if (scope.signal.aborted) return;
    cancelFrame?.();
    cancelFrame = undefined;
    pending = false;
    const keys = new Set(dirty), every = all;
    dirty.clear();
    all = false;
    for (const f of [...flushers]) {
      if (!every && !keys.has(f.key)) continue;
      try { f.fn(); } catch (e) { warn(`scheduler: flusher "${f.key}" threw:`, e); }
    }
  }
  return {
    onFlush(key, fn) {
      const f = { key, fn };
      flushers.push(f);
      return () => { const i = flushers.indexOf(f); if (i >= 0) flushers.splice(i, 1); };
    },
    invalidate(key) {
      if (scope.signal.aborted) return;
      if (key === undefined) all = true; else dirty.add(key);
      if (!pending) { pending = true; request(flushNow); }
    },
    flushNow,
    dispose() { scope.dispose(); dirty.clear(); flushers.length = 0; },
  };
}
