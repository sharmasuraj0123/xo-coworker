// @ts-check
import { ownLayer } from "../layers.js";
import { prepareStageNavigation } from "./navigation.js";
import { PHONE } from "../../core/platform/viewport.js";
import { panelPlace } from "../place-context.js";
import { createPanelThreadOpener } from "./thread-navigation.js";
import { createStage } from "./panel.js";
import { bindPanelHeaderControls } from "./header-controls.js";
import { wireHeaderActions } from "../header.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const stageModule = {
  manifest: { id: "xo.stage", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["placeContext", "shape", "world", "currentView", "navigation", "mapAgents", "threadGroups",
      "shellDock", "announce", "launchpad", "conversationSession"],
    optional: ["files", "shellPanel", "mapControls"], provides: ["stage"], contributes: ["panel.page", "workspace.paint:stage"] },
  activate(ctx) {
    const place = ctx.use("placeContext"), shape = ctx.use("shape"), view = ctx.use("currentView");
    const session = ctx.use("conversationSession"), files = () => ctx.optional("files");
    const go = createPanelThreadOpener({ view, world: ctx.use("world"), go: ctx.use("navigation").go,
      panelConversation: () => session.panel()?.C, showMsg: session.showMsg });
    const at = () => place.atOf(view());
    const stage = createStage({
      at, view, go, place: panelPlace, frames: () => shape.list("panel").map((frame) => frame.id.slice("xo:panel/".length)),
      mapControls: () => ctx.optional("mapControls"),
      files: { changes: (where) => files()?.tree.changes(where) ?? [] }, openFiles: () => files()?.page.show({ focus: true }),
      viewer: { open: (file, from) => files()?.viewer.open(file, from) }, announce: ctx.use("announce"),
      agents: ctx.use("mapAgents").agents, threads: ctx.use("threadGroups").panelThreads, owns: ctx.use("shellDock").owns,
      shell: (on, host, where) => ctx.optional("shellPanel")?.panelShell(on, host, where), onChange: () => ctx.invalidate("workspace"),
      places: { ...ctx.places, contribute: ctx.contribute },
    });
    stage.names = place.panelName;
    ctx.effect(() => stage.disposeLayout);
    wireHeaderActions(ctx, ctx.places, at);
    bindPanelHeaderControls(ctx, stage, ctx.use("launchpad").LW, view);
    ctx.on("app:view-preparing", (change) => prepareStageNavigation(stage, !!PHONE?.matches, change));
    ctx.contribute("workspace.paint", { id: "stage", order: 70, paint: () => stage.sync() });
    ownLayer(ctx, { id: "panel-sheet", open: () => stage.isOpen && !!PHONE?.matches, close: () => { stage.close(); } });
    ctx.provide("stage", stage);
  },
};
