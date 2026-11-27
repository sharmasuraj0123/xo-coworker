// @ts-check
import { captureCoderToken } from "../core/platform/http.js";
import { trackPress } from "../core/ui/press.js";
import { defineXoSelect } from "../core/ui/components/xo-select.js";
import { defineXoDate } from "../core/ui/components/xo-date.js";
import { drawPlaceIcons, drawFrameIcons } from "./frame-icons.js";
import { startShell } from "./start.js";
import { PHONE } from "../core/platform/viewport.js";
import { createShellKernel } from "./kernel.js";

/** @import { ModuleDef } from "../core/kernel/types" */

/** @param {ModuleDef[]} modules */
export async function bootShell(modules) {
  captureCoderToken();
  const kernel = createShellKernel();
  defineXoSelect();
  defineXoDate();
  drawPlaceIcons();
  drawFrameIcons();
  kernel.register({
    manifest: { id: "xo.page-lifetime", kernel: "^1.1.0", version: "1.0.0", core: true },
    activate(ctx) {
      ctx.listen(window, "pagehide", (event) => {
        ctx.emit("app:pagehide");
        if (!("persisted" in event && event.persisted)) kernel.dispose();
      });
    },
  });
  for (const module of modules) kernel.register(module);
  const report = await kernel.start();
  kernel.bus.emit("app:started", report);
  return kernel;
}

/** @type {import("../core/kernel/types").ModuleDef} */
export const startupModule = {
  manifest: { id: "xo.startup", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["theme", "rail", "drawer", "world", "mainViewport", "composer"] },
  activate(ctx) {
    trackPress(document, ctx);
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
