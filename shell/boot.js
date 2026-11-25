// @ts-check
import { drawPlaceIcons, drawFrameIcons } from "./frame-icons.js";
import { kernel } from "./kernel.js";
import { createScope } from "../core/kernel/scope.js";

/** @import { ModuleDef } from "../core/kernel/types" */

/** @param {ModuleDef[]} modules @param {string} shapeIcon */
export async function bootShell(modules, shapeIcon) {
  const scope = createScope();
  drawPlaceIcons();
  drawFrameIcons(shapeIcon);
  scope.effect(() => kernel.dispose);
  for (const module of modules) kernel.register(module);
  scope.listen(window, "pagehide", (event) => {
    kernel.bus.emit("app:pagehide");
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  const report = await kernel.start();
  kernel.bus.emit("app:started", report);
}
