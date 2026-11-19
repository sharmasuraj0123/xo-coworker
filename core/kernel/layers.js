// @ts-check
// One stack of open layers. Escape and phone Back are offered to the top layer first, then down the
// stack, until one takes them; the shell reads list() for inert and the Tab trap. Before this, app.js
// kept six lists that disagreed (architecture/modular/analysis/1-app-index.md §3.4).

/** @typedef {import("./types").Layer} Layer @typedef {import("./types").Layers} Layers */

/** @param {(...a: unknown[]) => void} [warn] @returns {Layers} */
export function createLayers(warn = console.error) {
  /** @type {Layer[]} */
  const stack = [];
  /** @type {Set<() => void>} */
  const watchers = new Set();
  const changed = () => { for (const fn of [...watchers]) { try { fn(); } catch (e) { warn("layers: a watcher threw:", e); } } };
  /** @param {"escape" | "back"} what */
  const offer = (what) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const fn = stack[i][what];
      try { if (fn && fn.call(stack[i]) === true) return true; } catch (e) { warn(`layers: ${what} of "${stack[i].id}" threw:`, e); return true; }
    }
    return false;
  };
  return {
    push(layer) {
      if (!layer || typeof layer.id !== "string") throw new Error("layers.push: a layer needs an id");
      stack.push(layer);
      changed();
      return () => {
        const i = stack.indexOf(layer);
        if (i < 0) return;
        stack.splice(i, 1);
        changed();
        const el = /** @type {any} */ (layer.returnFocus);
        if (el && el.isConnected && typeof el.focus === "function") el.focus({ preventScroll: true });
      };
    },
    top: () => stack[stack.length - 1],
    list: () => stack.slice(),
    escape: () => offer("escape"),
    back: () => offer("back"),
    watch(fn) { watchers.add(fn); return () => { watchers.delete(fn); }; },
  };
}
