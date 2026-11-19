// @ts-check
// Batched redraws. invalidate(key) marks a key; the next frame runs each marked key's flushers once, in
// the order they were registered (so a region always draws after what it depends on, as it does today).
// invalidate() with no key marks them all (the legacy app's render() is one flusher until it is gone).

/** @typedef {import("./types").Scheduler} Scheduler */

/**
 * @param {{ request?: (fn: () => void) => unknown, warn?: (...a: unknown[]) => void }} [opts]
 *   request: how to wait for the next flush (default: requestAnimationFrame, else a microtask)
 * @returns {Scheduler}
 */
export function createScheduler(opts = {}) {
  const warn = opts.warn || console.error;
  const request = opts.request
    || (typeof requestAnimationFrame === "function" ? (/** @type {() => void} */ fn) => requestAnimationFrame(() => fn()) : queueMicrotask);
  /** @type {Array<{ key: string, fn: () => void }>} */
  const flushers = [];
  /** @type {Set<string>} */
  const dirty = new Set();
  let all = false, pending = false;

  function flushNow() {
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
      if (key === undefined) all = true; else dirty.add(key);
      if (!pending) { pending = true; request(flushNow); }
    },
    flushNow,
  };
}
