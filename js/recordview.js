// @ts-check
import { createMade } from "../modules/artifacts/made.js";
import { madeSection } from "../modules/artifacts/section.js";
import { createScope } from "../core/kernel/scope.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";

/** @param {Omit<Parameters<typeof createMade>[0], "skTile" | "skBar" | "rememberedMade"> & {places: Pick<import("../core/kernel/types").Places, "contribute">}} deps */
export function createRecord({ world, go, VW, PROJ, schedule, announce, places, scope }) {
  const lifetime = createScope();
  try {
    const made = createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade, scope });
    lifetime.effect(() => made.dispose);

    lifetime.effect(() => places.contribute("home.section", madeSection(made), "xo.artifacts"));

    return {
      dispose: lifetime.dispose,
      homeMade: made.homeMade, jumpItems: made.jumpItems, latestOf: made.latestOf,
      artifacts: made.artifacts,
    };
  } catch (error) {
    lifetime.dispose();
    throw error;
  }
}
