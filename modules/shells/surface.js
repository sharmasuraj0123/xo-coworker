// @ts-check
import { ownLayer } from "../../shell/layers.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { createShells } from "./dock.js";
import { createShellPanel } from "./panel.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const shellDockModule = {
  manifest: { id: "xo.shell-dock", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["shape", "terminalCapability", "projectName", "notices", "announce"], provides: ["shellDock"] },
  activate(ctx) {
    const shape = ctx.use("shape"), notices = ctx.use("notices"), terminal = ctx.use("terminalCapability");
    const dock = createShells({ PROJ: ctx.use("projectName"), announce: ctx.use("announce"), wanted: () => shape.on("xo:dock/shells"),
      notify: (notice) => notices.show(notice, 6000), onChange: () => ctx.invalidate("workspace") });
    ctx.effect(() => dock.dispose);
    ctx.effect(() => terminal(() => dock.available));
    ownLayer(ctx, { id: "shells", open: () => dock.raised, close: () => dock.lower() });
    ctx.provide("shellDock", dock);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const shellPanelModule = {
  manifest: { id: "xo.shells", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["shellDock", "stage", "world", "notices", "currentView"], provides: ["shellPanel"], contributes: ["conversation.press:shell"] },
  activate(ctx) {
    const panel = createShellPanel({ SH: ctx.use("shellDock"), STAGE: ctx.use("stage"), world: ctx.use("world"),
      heraldShow: ctx.use("notices").show, view: ctx.use("currentView") });
    ctx.effect(() => panel.dispose);
    ctx.contribute("conversation.press", pressEntry("shell", valuePress("data-shell", (id) => panel.openShell(id), true)));
    ctx.provide("shellPanel", panel);
  },
};
