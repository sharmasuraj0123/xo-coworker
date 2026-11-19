// @ts-check
// A bag of undos: everything a module registers lands here, and dispose() runs them all, newest first.
// One undo that throws is logged and never stops the others (a broken listener can't strand the rest).

/** @typedef {import("./types").Undo} Undo */

/** @param {(...a: unknown[]) => void} [warn] */
export function createUndos(warn = console.error) {
  /** @type {Set<Undo>} */
  const live = new Set();
  return {
    /** Keep an undo; returns a wrapper that runs it once and forgets it. @param {Undo | void | undefined} fn @returns {Undo} */
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
    /** Run every undo, newest first. */
    dispose() {
      for (const fn of [...live].reverse()) fn();
    },
    get size() { return live.size; },
  };
}
