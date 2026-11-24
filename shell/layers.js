// @ts-check

/** @typedef {{ id: string, open: () => boolean, close: () => boolean | void, overlay?: boolean, tab?: () => HTMLElement | null, inertsApp?: boolean, watchHidden?: HTMLElement }} AppLayer */
const ORDER = {
  back: ["create", "jump", "intel", "chat-setup", "runs", "keys", "all", "lightbox", "files-page", "viewer", "panel-sheet", "settings", "shells", "drawer", "decisions"],
  escape: ["jump", "intel", "quickopen", "runs", "keys", "all", "settings", "files-page", "drawer", "decisions", "chat-setup"],
  tab: ["keys", "all", "jump", "settings", "drawer"],
};

/** @param {import("../core/kernel/types").Layers} layers @param {AppLayer[]} list */
export function stackLayers(layers, list) {
  const entries = new Map(list.map((layer) => [layer.id, layer]));
  if (entries.size !== list.length) throw new Error("shell layers must have unique ids");
  const ids = [...new Set([...ORDER.back, ...ORDER.escape])];
  for (const id of entries.keys()) if (!ids.includes(id)) throw new Error(`layer "${id}" has no place in the shell's order`);
  const undos = ids.reverse().flatMap((id) => {
    const layer = entries.get(id);
    if (!layer) return [];
    const close = () => layer.open() && layer.close() !== false;
    return layers.push({ id, back: ORDER.back.includes(id) ? close : undefined, escape: ORDER.escape.includes(id) ? close : undefined });
  });
  return {
    back: () => layers.back(ORDER.back),
    escape: () => layers.escape(ORDER.escape),
    keyLayer: () => {
      for (const id of ORDER.tab) {
        const layer = entries.get(id);
        if (!layer?.open()) continue;
        const el = layer.tab?.();
        if (el) return el;
      }
      return null;
    },
    isOpen: (/** @type {string} */ id) => entries.get(id)?.open() ?? false,
    inertsApp: () => list.some((layer) => layer.inertsApp && layer.open()),
    watched: list.flatMap((layer) => layer.watchHidden ? [layer.watchHidden] : []),
    open: ({ overlay = false } = {}) => list.some((l) => (!overlay || l.overlay !== false) && l.open()),
    undo: () => { for (const u of undos.reverse()) u(); },
  };
}
