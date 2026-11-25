// @ts-check
import { layerQueries } from "./layer-queries.js";

const ORDER = {
  back: ["create", "jump", "intel", "chat-setup", "runs", "keys", "lightbox", "files-page", "viewer", "panel-sheet", "settings", "shells", "drawer", "decisions"],
  escape: ["jump", "intel", "quickopen", "runs", "keys", "settings", "files-page", "drawer", "decisions", "chat-setup"],
  tab: ["keys", "jump", "settings", "drawer"],
};
/** @import { ModuleContext, Layer } from "../core/kernel/types" */

/** @param {Pick<ModuleContext, "pushLayer" | "layers">} ctx @param {import("./layer-queries.js").AppLayer} layer */
export function ownLayer(ctx, layer) {
  const { id, close, ...details } = layer;
  if (!ORDER.escape.includes(id) && !ORDER.back.includes(id)) throw new Error(`layer "${id}" has no place in the shell's order`);
  if (ctx.layers.list().some((active) => active.id === id)) throw new Error("shell layers must have unique ids");
  const dismiss = () => layer.open() && close() !== false;
  return ctx.pushLayer({ ...details, id, back: ORDER.back.includes(id) ? dismiss : undefined,
    escape: ORDER.escape.includes(id) ? dismiss : undefined });
}

/** @param {ModuleContext["layers"]} layers */
export function stackLayers(layers) {
  return {
    back: () => layers.back(["failure-details", ...ORDER.back]),
    escape: () => layers.escape(["failure-details", ...ORDER.escape]),
    ...layerQueries(layers.list, ORDER.tab),
    open: layers.open, watch: layers.watch,
  };
}
