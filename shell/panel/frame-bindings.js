// @ts-check

import { ownSurface } from "../surfaces.js";

/** @import { MapFrame, ChangesFrame, ChangesFrameOptions, StageDeps } from "./panel-types.d.ts" */

/** @import { SurfaceScope } from "../surface-types.d.ts" */

/** @typedef {{ places: StageDeps["places"], scope: SurfaceScope, hosts: { map: HTMLElement, changes: HTMLElement } }} BindHosts */

/** @typedef {{ options: ChangesFrameOptions, fallback: () => HTMLElement, refresh: () => void }} BindActions */

/** @param {BindHosts & BindActions & Pick<StageDeps, "mapControls">} deps */
export function bindPanelFrames({ places, scope, mapControls, hosts, options, fallback, refresh }) {
  /** @type {MapFrame | undefined} */
  let mapFrame;
  /** @type {ChangesFrame | undefined} */
  let changeFrame;
  /** @type {ReturnType<ChangesFrame["mount"]> | undefined} */
  let changes;
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
  }

  scope.effect(() => places.watch("panel.frame", () => { sync(); refresh(); }));
  sync();
  return {
    get map() { return mapFrame ? mapControls?.() : undefined; },
    get changes() { return changes; },
    /** @param {string} theme */
    theme(theme) { changeFrame?.theme(theme); },
  };
}
