// @ts-check
import { mountPressRoutes, valuePress } from "../../shell/conversation-press.js";
import { createShells } from "./dock.js";
import { createShellPanel } from "./panel.js";

/** @import { Places, ModuleContext } from "../../core/kernel/types" */

/** @typedef {import("./panel-types").ShellPanelDeps} Panel */

/** @typedef {ReturnType<typeof import("../../core/services/shape/application.js").createApplicationShape>} ApplicationShape */

/** @typedef {Pick<Panel, "world" | "view" | "heraldShow"> & { applicationShape: ApplicationShape, places: Places }} PanelHost */

/** @param {Pick<ModuleContext, "effect">} scope @param {PanelHost & import("./dock-types").DockOptions} host */
export function mountShells(scope, host) {
  const { applicationShape, heraldShow } = host;
  const SH = createShells({ ...host, notify: (notice) => heraldShow(notice, 6000),
    wanted: () => applicationShape.shape.on("xo:dock/shells") });
  applicationShape.terminal(() => SH.available);
  scope.effect(() => SH.dispose);
  /** @param {Panel["STAGE"]} STAGE */
  function mountPanel(STAGE) {
    const panel = createShellPanel({ ...host, SH, STAGE });
    scope.effect(() => panel.dispose);
    scope.effect(() => mountPressRoutes(host.places, "xo.shells", { shell: valuePress("data-shell", (id) => panel.openShell(id), true) }));
    return panel.panelShell;
  }
  return { SH, mountPanel };
}
