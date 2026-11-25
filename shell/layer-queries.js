// @ts-check

/** @typedef {{ id: string, open: () => boolean, close: () => boolean | void, overlay?: boolean, tab?: () => HTMLElement | null, inertsApp?: boolean, watchHidden?: HTMLElement }} AppLayer */

/** @param {() => readonly import("../core/kernel/types").Layer[]} entries @param {readonly string[]} tabOrder */
export function layerQueries(entries, tabOrder) {
  const find = (/** @type {string} */ id) => entries().find((layer) => layer.id === id);

  function keyLayer() {
    for (const id of tabOrder) {
      const layer = find(id);
      if (!layer?.open?.()) continue;
      const el = layer.tab?.();
      if (el) return el;
    }
    return null;
  }

  return {
    keyLayer,
    isOpen: (/** @type {string} */ id) => find(id)?.open?.() ?? false,
    inertsApp: () => entries().some((layer) => layer.inertsApp && layer.open?.()),
    watched: () => entries().flatMap((layer) => layer.watchHidden ? [layer.watchHidden] : []),
  };
}
