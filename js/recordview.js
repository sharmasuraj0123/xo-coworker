// @ts-check
import { createSince } from "../modules/since/view.js";
import { createMade } from "../modules/artifacts/made.js";
import { sinceSection } from "../modules/since/section.js";
import { madeSection } from "../modules/artifacts/section.js";
import { api } from "../core/platform/api.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";

/** @param {Omit<Parameters<typeof createMade>[0], "skTile" | "skBar" | "rememberedMade"> & {mark?: () => string, places: Pick<ReturnType<typeof import("../core/kernel/places.js").createPlaces>, "contribute">}} deps */
export function createRecord({ world, go, VW, PROJ, schedule, announce, mark = () => "", places }) {
  const SL = createSince({ world, api, schedule, announce });
  const MD = createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade });

  places.contribute("home.section", sinceSection(SL), "xo.since");
  places.contribute("home.section", madeSection({ homeMade: MD.homeMade }), "xo.artifacts");

  return {
    placeOf: SL.placeOf, leave: SL.leave, sinceLine: SL.sinceLine, homeSinceLines: SL.homeSinceLines,
    homeMade: MD.homeMade, madeCount: MD.madeCount, jumpItems: MD.jumpItems, latestOf: MD.latestOf, artifacts: MD.artifacts, made: MD.made,
    /** @param {{isOpen?: boolean} | null} p */
    set panel(p) { MD.panel = p; },
    refresh() { MD.refresh(); },
    /** @param {() => string | null} fn */
    set view(fn) { SL.view = fn; },
  };
}
