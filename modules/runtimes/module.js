// @ts-check
import { createRuntimeSettings } from "./settings.js";
import { createThreadRuntime } from "./thread.js";
import { createLifecycle } from "./lifecycle.js";
import { createUninstall } from "./uninstall.js";
import { api } from "../../core/platform/api.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const threadRuntimeModule = {
  manifest: { id: "xo.thread-runtime", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "shape", "threadPresentation"], provides: ["threadRuntime"] },
  activate(ctx) {
    ctx.provide("threadRuntime", createThreadRuntime({
      world: ctx.use("world"), SHAPE: ctx.use("shape"), isHeld: ctx.use("threadPresentation").isHeld,
    }));
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const runtimeSettingsModule = {
  manifest: { id: "xo.runtime-settings", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["announce", "world", "navigation"], provides: ["mountRuntimeSettings"] },
  activate(ctx) {
    const world = ctx.use("world"), announce = ctx.use("announce"), { go } = ctx.use("navigation");
    const life = createLifecycle({ api, refresh: () => world.act.loadRuntimes(), announce, scope: ctx });
    const dialog = createUninstall({
      run: (name, force) => life.run(name, "uninstall", { force }), state: () => world.state, go, scope: ctx,
      pushLayer: (layer) => ctx.pushLayer(layer),
    });
    ctx.provide("mountRuntimeSettings", (host) => createRuntimeSettings({ ...host, world, announce, life, uninstall: dialog.ask }));
  },
};
