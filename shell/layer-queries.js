// @ts-check

/** @typedef {{ id: string, open: () => boolean, close: () => boolean | void, overlay?: boolean, tab?: () => HTMLElement | null, inertsApp?: boolean, watchHidden?: HTMLElement }} AppLayer */

/** @param {ReadonlyMap<string, AppLayer>} entries @param {readonly string[]} tabOrder */
export function layerQueries(entries, tabOrder) {
  const surfaces = [...entries.values()];

  function keyLayer() {
    for (const id of tabOrder) {
      const layer = entries.get(id);
      if (!layer?.open()) continue;
      const el = layer.tab?.();
      if (el) return el;
    }
    return null;
  }

  return {
    keyLayer,
    isOpen: (/** @type {string} */ id) => entries.get(id)?.open() ?? false,
    inertsApp: () => surfaces.some((layer) => layer.inertsApp && layer.open()),
    watched: surfaces.flatMap((layer) => layer.watchHidden ? [layer.watchHidden] : []),
    open: ({ overlay = false } = {}) => surfaces.some((layer) => (!overlay || layer.overlay !== false) && layer.open()),
  };
}
