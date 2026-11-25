// @ts-check

/** @typedef {import("./types").Bus} Bus */

/** @param {(...a: unknown[]) => void} [warn] @returns {Bus} */
export function createBus(warn = console.error) {
  /** @type {Map<string, Set<(payload: unknown) => void>>} */
  const topics = new Map();
  /** @param {string} topic @param {(payload: unknown) => void} notify */
  function listen(topic, notify) {
    let set = topics.get(topic);
    if (!set) topics.set(topic, (set = new Set()));
    set.add(notify);
    return () => { set.delete(notify); if (!set.size) topics.delete(topic); };
  }
  return {
    on(topic, ...[fn]) {
      return listen(topic, (p) => fn(/** @type {Parameters<typeof fn>[0]} */ (p)));
    },
    once(topic, ...[fn]) {
      const off = listen(topic, (p) => { off(); fn(/** @type {Parameters<typeof fn>[0]} */ (p)); });
      return off;
    },
    emit(...[topic, payload]) {
      const set = topics.get(topic);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(payload); } catch (e) { warn(`bus: a listener of "${topic}" threw:`, e); }
      }
    },
  };
}
