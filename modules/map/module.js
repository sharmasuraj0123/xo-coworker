// @ts-check
import { stepLineHtml } from "../../core/ui/markdown/inline.js";
import { createMapAgents } from "./agents.js";
import { createMap } from "./map.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const mapAgentsModule = {
  manifest: { id: "xo.agent-activity", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "threadPresentation"], provides: ["mapAgents"] },
  activate(ctx) {
    ctx.provide("mapAgents", createMapAgents({ world: ctx.use("world"), isBusy: ctx.use("threadPresentation").isBusy, stepLineHtml }));
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const mapModule = {
  manifest: {
    id: "xo.map", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "navigation", "threadPresentation", "mapAgents", "currentView"], contributes: ["panel.frame:map"],
  },
  activate(ctx) {
    const navigation = ctx.use("navigation");
    const api = createMap({
      world: ctx.use("world"), announce: ctx.use("announce"), isBusy: ctx.use("threadPresentation").isBusy, activity: ctx.use("mapAgents"),
      go: (view) => navigation.go(view, { panel: true }),
      openFile: (file, from) => ctx.emit("app:open-file", { file, from }),
    });
    const view = ctx.use("currentView");
    ctx.on("app:render", () => api.render(view()));
    ctx.contribute("panel.frame", {
      id: "map", title: "Map", api,
      mount(/** @type {HTMLElement} */ host) { api.mount(host); return () => api.unmount(); },
    });
  },
};
