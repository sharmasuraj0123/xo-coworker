// @ts-check

/** @typedef {import("./types").Undo} Undo */

/** @param {(...a: unknown[]) => void} [warn] */
export function createUndos(warn = console.error) {
  /** @type {Set<Undo>} */
  const live = new Set();
  return {
    /** @param {Undo | void | undefined} fn @returns {Undo} */
    add(fn) {
      if (typeof fn !== "function") return () => {};
      let done = false;
      /** @type {Undo} */
      const once = () => {
        if (done) return;
        done = true;
        live.delete(once);
        try { fn(); } catch (e) { warn("undo failed:", e); }
      };
      live.add(once);
      return once;
    },
    dispose() {
      for (const fn of [...live].reverse()) fn();
    },
    get size() { return live.size; },
  };
}
