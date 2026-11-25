// @ts-check
import { createAppServices } from "./app-services.js";
import { createWorld } from "../core/services/world/store.js";
import { createNavigationState } from "./navigation-state.js";
import { createAnnouncer } from "../core/ui/a11y/announce.js";
import { requireHtml } from "../core/platform/dom.js";
import { createPlaceContext } from "./place-context.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const appServicesModule = {
  manifest: { id: "xo.app-services", version: "1.0.0", kernel: "^1.1.0", core: true,
    provides: ["world", "announce", "projectName", "currentView", "placeContext", "navigationState"] },
  activate(ctx) {
    const world = createWorld();
    ctx.effect(() => world.dispose);
    const location = createNavigationState(), place = createPlaceContext(world);
    ctx.effect(() => place.mountNames(location.view));
    const announce = createAnnouncer(requireHtml("#live"), ctx);
    const schedule = () => ctx.emit("app:render");
    ctx.provide("navigationState", location);
    return createAppServices({ world, announce, projectName: place.PROJ, currentView: location.view }, schedule, place).activate(ctx);
  },
};
