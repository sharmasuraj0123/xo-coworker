// @ts-check

/** @typedef {import("./types").Layer} Layer @typedef {import("./types").Layers} Layers */

/** @param {import("./types").Warn} [warn] @returns {Layers} */
export function createLayers(warn = console.error) {
  /** @type {Layer[]} */
  const stack = [];
  /** @type {Set<() => void>} */
  const watchers = new Set();
  const changed = () => { for (const fn of [...watchers]) { try { fn(); } catch (e) { warn({ module: "layers", phase: "watch" }, e); } } };
  /** @param {"escape" | "back"} what @param {readonly string[]} [order] */
  const offer = (what, order) => {
    const candidates = order ? stack.filter((layer) => layer[what]) : stack;
    if (order) {
      for (const layer of candidates) {
        if (!order.includes(layer.id)) throw new Error(`layer "${layer.id}" has no place in the ${what} order`);
      }
      candidates.sort((a, b) => order.indexOf(b.id) - order.indexOf(a.id));
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      const layer = candidates[i];
      const fn = layer[what];
      try {
        if (fn && fn.call(layer) === true) return true;
      } catch (e) {
        warn({ module: "layers", phase: what, subject: layer.id }, e);
        return true;
      }
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
        const el = layer.returnFocus;
        if (el?.isConnected && "focus" in el && typeof el.focus === "function") el.focus({ preventScroll: true });
      };
    },
    top: () => stack[stack.length - 1],
    list: () => stack.slice(),
    escape: (order) => offer("escape", order),
    back: (order) => offer("back", order),
    watch(fn) { watchers.add(fn); return () => { watchers.delete(fn); }; },
  };
}
