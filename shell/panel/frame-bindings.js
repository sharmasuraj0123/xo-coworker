// @ts-check

import { ownSurface } from "../surfaces.js";

/** @import { MapFrame, ChangesFrame, ChangesFrameOptions, AutomationsFrame, AutomationsPanel, StageDeps } from "./panel-types.d.ts" */

/** @import { SurfaceScope } from "../surface-types.d.ts" */

/** @typedef {"automations" | "personas"} FixedId */

/** @typedef {{ map: HTMLElement, changes: HTMLElement, fixed: Record<FixedId, HTMLElement> }} FrameHosts */

/** @typedef {{ places: StageDeps["places"], scope: SurfaceScope, hosts: FrameHosts }} BindHosts */

/** @typedef {{ options: ChangesFrameOptions, fallback: () => HTMLElement, refresh: () => void }} BindActions */

/** @param {BindHosts & BindActions & Pick<StageDeps, "mapControls">} deps */
export function bindPanelFrames({ places, scope, mapControls, hosts, options, fallback, refresh }) {
  /** @type {MapFrame | undefined} */
  let mapFrame;
  /** @type {ChangesFrame | undefined} */
  let changeFrame;
  /** @type {ReturnType<ChangesFrame["mount"]> | undefined} */
  let changes;
  /** @type {Record<string, { entry: AutomationsFrame, panel: AutomationsPanel, retire: () => void }>} */
  const fixed = {};
  let retireMap = () => {}, retireChanges = () => {};

  function sync() {
    const mapEntry = places.get("panel.frame", "map");

    const changesEntry = places.get("panel.frame", "changes");
    if (mapEntry !== mapFrame) {
      retireMap();
      mapFrame = mapEntry;
      if (mapEntry) {
        const dispose = mapEntry.mount(hosts.map);
        retireMap = ownSurface(scope, hosts.map, () => { mapFrame = undefined; dispose?.(); }, fallback);
      }
    }
    if (changesEntry !== changeFrame) {
      retireChanges();
      changeFrame = changesEntry;
      if (changesEntry) {
        const controller = changesEntry.mount(hosts.changes, options);
        changes = controller;
        retireChanges = ownSurface(scope, hosts.changes, () => {
          changeFrame = undefined;
          changes = undefined;
          controller.dispose?.();
        }, fallback);
      }
    }
    for (const id of /** @type {FixedId[]} */ (["automations", "personas"])) syncFixed(id);
  }

  /** A frame that sizes to its rows under Threads. @param {FixedId} id */
  function syncFixed(id) {
    const entry = places.get("panel.frame", id), was = fixed[id];
    if (entry === was?.entry) return;
    was?.retire();
    delete fixed[id];
    if (!entry) return;
    const panel = entry.mount(hosts.fixed[id]);
    const gone = () => { if (fixed[id]?.panel === panel) delete fixed[id]; panel.dispose(); };
    fixed[id] = { entry, panel, retire: () => {} };
    fixed[id].retire = ownSurface(scope, hosts.fixed[id], gone, fallback);
  }

  scope.effect(() => places.watch("panel.frame", () => { sync(); refresh(); }));
  sync();
  return {
    get map() { return mapFrame ? mapControls?.() : undefined; },
    get changes() { return changes; },
    /** @param {FixedId} id */
    fixed: (id) => fixed[id]?.panel,
    /** @param {string} theme */
    theme(theme) { changeFrame?.theme(theme); },
  };
}
