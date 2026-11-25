// @ts-check
import { layerQueries } from "./layer-queries.js";

const ORDER = {
  back: ["create", "jump", "intel", "chat-setup", "runs", "keys", "lightbox", "files-page", "viewer", "panel-sheet", "settings", "shells", "drawer", "decisions"],
  escape: ["jump", "intel", "quickopen", "runs", "keys", "settings", "files-page", "drawer", "decisions", "chat-setup"],
  tab: ["keys", "jump", "settings", "drawer"],
};
/** @param {import("../core/kernel/types").Layers} layers @param {import("./layer-queries.js").AppLayer[]} list */
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
    back: () => layers.back(["failure-details", ...ORDER.back]),
    escape: () => layers.escape(["failure-details", ...ORDER.escape]),
    ...layerQueries(entries, ORDER.tab),
    undo: () => { for (const u of undos.reverse()) u(); },
  };
}
