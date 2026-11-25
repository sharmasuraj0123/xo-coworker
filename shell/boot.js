// @ts-check
import { defineXoSelect } from "../core/ui/components/xo-select.js";
import { drawPlaceIcons, drawFrameIcons } from "./frame-icons.js";
import { startShell } from "./start.js";
import { PHONE } from "../core/platform/viewport.js";
import { kernel } from "./kernel.js";
import { createScope } from "../core/kernel/scope.js";

/** @import { ModuleDef } from "../core/kernel/types" */

/** @param {ModuleDef[]} modules */
export async function bootShell(modules) {
  const scope = createScope();
  defineXoSelect();
  drawPlaceIcons();
  drawFrameIcons();
  scope.effect(() => kernel.dispose);
  for (const module of modules) kernel.register(module);
  scope.listen(window, "pagehide", (event) => {
    kernel.bus.emit("app:pagehide");
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  const report = await kernel.start();
  kernel.bus.emit("app:started", report);
}

/** @type {import("../core/kernel/types").ModuleDef} */
export const startupModule = {
  manifest: { id: "xo.startup", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["theme", "rail", "drawer", "world", "mainViewport", "composer"] },
  activate(ctx) {
    const phone = PHONE;
    if (!phone) throw new Error("The application requires media queries.");
    const setDrawer = ctx.use("drawer").set;
    ctx.on("app:view-preparing", () => setDrawer(false));
    ctx.on("app:started", () => ctx.effect(() => startShell({
      ...ctx.use("theme"), SIDE: ctx.use("rail").side, PHONE: phone, setDrawer, render: () => ctx.emit("app:render"),
      world: ctx.use("world"), schedule: () => ctx.invalidate("workspace"), follow: ctx.use("mainViewport").follow,
      loadDraft: ctx.use("composer").loadDraft,
    })));
  },
};
