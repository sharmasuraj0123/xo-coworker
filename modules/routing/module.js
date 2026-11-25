// @ts-check

import { createRoutingPage } from "./page.js";
import { PAGE } from "./constants.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const routingModule = {
  manifest: { id: "xo.routing", version: "1.0.0", kernel: "^1.1.0", needs: ["settings", "world", "announce", "projectName"] },
  activate(ctx) {
    const settings = ctx.use("settings");
    const page = createRoutingPage(settings, {
      world: ctx.use("world"), announce: ctx.use("announce"), PROJ: ctx.use("projectName"), onChange: () => ctx.invalidate("workspace"),
    });
    ctx.effect(() => page.dispose);
    ctx.effect(() => settings.bindPage(PAGE, page));
  },
};
