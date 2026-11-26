// @ts-check
import { createMade } from "./made.js";
import { madeSection } from "./section.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const artifactsModule = {
  manifest: {
    id: "xo.artifacts", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "projectName", "navigation", "homeSkeleton"],
    provides: ["artifactCatalog"],
    contributes: ["home.section:hm-made", "page:artifacts", "search.provider:artifacts"],
  },
  activate(ctx) {
    const made = createMade({
      ...ctx.use("homeSkeleton"), scope: ctx, world: ctx.use("world"), PROJ: ctx.use("projectName"),
      announce: ctx.use("announce"), go: ctx.use("navigation").go, schedule: () => ctx.invalidate("workspace"),
      VW: { open: (file, from) => ctx.emit("app:open-file", { file, from }) },
    });
    ctx.contribute("home.section", madeSection(made));
    ctx.provide("artifactCatalog", { latestOf: made.latestOf });
    ctx.contribute("page", { id: "artifacts", ...made.artifacts });
    ctx.contribute("search.provider", {
      id: "artifacts", items: made.jumpItems,
      pick: (/** @type {ReturnType<typeof made.jumpItems>[number]} */ item) => item.run(),
    });
  },
};
