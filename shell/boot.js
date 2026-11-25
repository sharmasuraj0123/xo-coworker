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
  for (const module of modules) {
    kernel.register(module);
    if (!module.manifest.core) scope.effect(() => () => { void kernel.disable(module.manifest.id); });
  }
  scope.listen(window, "pagehide", (event) => {
    kernel.bus.emit("app:pagehide");
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  await kernel.start();
  scope.effect(() => startShell(startup));
}
