// @ts-check

import { createMap } from "./map.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { MapDeps, MapController } from "./map-types.d.ts" */

/** @param {Omit<MapDeps, "world" | "announce">} options */
export function createMapModule(options) {
  /** @type {MapController | undefined} */
  let active;
  /** @type {ModuleDef} */
  const module = {
    manifest: {
      id: "xo.map", version: "1.0.0", kernel: "^1.1.0", needs: ["world", "announce"], contributes: ["panel.frame:map"],
    },
    activate(ctx) {
      const map = createMap({ ...options, world: ctx.use("world"), announce: ctx.use("announce") });
      active = map;
      ctx.effect(() => () => { active = undefined; });
      ctx.contribute("panel.frame", {
        id: "map", title: "Map", api: map,
        mount(/** @type {HTMLElement} */ host) {
          map.mount(host);
          return () => map.unmount();
        },
      });
    },
  };
  return {
    module,
    /** @param {string} view */
    agents: (view) => active?.agents(view) ?? [],
    /** @param {string} view */
    render: (view) => active?.render(view),
  };
}
