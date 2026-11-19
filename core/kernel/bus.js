// @ts-check

/** @typedef {import("./types").Bus} Bus */

/** @param {(...a: unknown[]) => void} [warn] @returns {Bus} */
export function createBus(warn = console.error) {
  /** @type {Map<string, Set<(p: any) => void>>} */
  const topics = new Map();
  /** @type {Bus} */
  const bus = {
    on(topic, fn) {
      let set = topics.get(topic);
      if (!set) topics.set(topic, (set = new Set()));
      const own = (/** @type {any} */ p) => fn(p);
      set.add(own);
      return () => { set.delete(own); if (!set.size) topics.delete(topic); };
    },
    once(topic, fn) {
      const off = bus.on(topic, (p) => { off(); fn(/** @type {any} */ (p)); });
      return off;
    },
    emit(topic, payload) {
      const set = topics.get(topic);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(payload); } catch (e) { warn(`bus: a listener of "${topic}" threw:`, e); }
      }
    },
  };
  return bus;
}
