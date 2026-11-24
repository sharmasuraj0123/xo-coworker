// @ts-check
import { createSince } from "../modules/since/view.js";
import { createMade } from "../modules/artifacts/made.js";
import { sinceSection } from "../modules/since/section.js";
import { madeSection } from "../modules/artifacts/section.js";
import { chatActivityApi } from "../core/platform/api.js";
import { createScope } from "../core/kernel/scope.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";

/** @param {Omit<Parameters<typeof createMade>[0], "skTile" | "skBar" | "rememberedMade"> & {world: import("../modules/since/model-types").SinceWorld, places: Pick<import("../core/kernel/types").Places, "contribute">}} deps */
export function createRecord({ world, go, VW, PROJ, schedule, announce, places, scope }) {
  const lifetime = createScope();
  try {
    const since = createSince({ world, api: chatActivityApi, schedule, announce });
    lifetime.effect(() => since.dispose);
    const made = createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade, scope });
    lifetime.effect(() => made.dispose);

    lifetime.effect(() => places.contribute("home.section", sinceSection(since), "xo.since"));
    lifetime.effect(() => places.contribute("home.section", madeSection(made), "xo.artifacts"));

    return {
      placeOf: since.placeOf, leave: since.leave, sinceLine: since.sinceLine, homeSinceLines: since.homeSinceLines,
      dispose: lifetime.dispose,
      homeMade: made.homeMade, madeCount: made.madeCount, jumpItems: made.jumpItems, latestOf: made.latestOf,
      artifacts: made.artifacts, made: made.made,
      /** @param {{isOpen?: boolean} | null} p */
      set panel(p) { made.panel = p; },
      refresh() { made.refresh(); },
      /** @param {() => string | null} fn */
      set view(fn) { since.view = fn; },
    };
  } catch (error) {
    lifetime.dispose();
    throw error;
  }
}
