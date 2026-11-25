// @ts-check
import { drawPlaceIcons, drawFrameIcons } from "./frame-icons.js";
import { kernel } from "./kernel.js";
import { startShell } from "./start.js";

/** @import { ModuleDef } from "../core/kernel/types" */

/** @typedef {ReturnType<typeof import("../core/kernel/scope.js").createScope>} Scope */

/** @typedef {Parameters<typeof startShell>[0] & { shapeIcon: string, dispose: (() => void)[] }} Startup */

/** @param {Scope} scope @param {ModuleDef[]} modules @param {Startup} startup */
export async function bootShell(scope, modules, startup) {
  drawPlaceIcons();
  drawFrameIcons(startup.shapeIcon);
  for (const dispose of startup.dispose) scope.effect(() => dispose);
  scope.effect(() => kernel.dispose);
  for (const module of modules) kernel.register(module);
  scope.listen(window, "pagehide", (event) => {
    kernel.bus.emit("app:pagehide");
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  const report = await kernel.start();
  kernel.bus.emit("app:started", report);
  scope.effect(() => startShell(startup));
}
