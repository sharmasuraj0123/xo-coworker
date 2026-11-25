// @ts-check
import { createPlaceContext } from "./place-context.js";

/** @import { ModuleDef } from "../core/kernel/types.d.ts" */

/** @import { AppServices } from "./app-service-types.d.ts" */

/** @param {AppServices} services @param {() => void} schedule @returns {ModuleDef} */
export function createAppServices({ world, announce, projectName, currentView }, schedule, place = createPlaceContext(world)) {
  return {
    manifest: {
      id: "xo.app-services", version: "1.0.0", kernel: "^1.1.0", core: true,
      provides: ["world", "announce", "projectName", "currentView", "placeContext"],
    },
    activate(ctx) {
      ctx.provide("world", world);
      ctx.provide("placeContext", place);
      ctx.provide("announce", announce);
      ctx.provide("projectName", projectName);
      ctx.provide("currentView", currentView);
      ctx.onFlush("workspace", schedule);
    },
  };
}
