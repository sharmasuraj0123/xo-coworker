// @ts-check
import { createMade } from "./made.js";
import { madeSection } from "./section.js";
import { createScope } from "../../core/kernel/scope.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const artifactsModule = {
  manifest: {
    id: "xo.artifacts", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "projectName", "navigation", "homeSkeleton"],
    contributes: ["home.section:hm-made", "page:artifacts", "search.provider:artifacts"],
  },
  activate(ctx) {
    const scope = createScope();
    ctx.effect(() => scope.dispose);
    const made = createMade({
      ...ctx.use("homeSkeleton"), scope, world: ctx.use("world"), PROJ: ctx.use("projectName"),
      announce: ctx.use("announce"), go: ctx.use("navigation").go, schedule: () => ctx.emit("app:render"),
      VW: { open: (file, from) => ctx.emit("app:open-file", { file, from }) },
    });
    ctx.contribute("home.section", madeSection(made));
    ctx.contribute("page", { id: "artifacts", ...made.artifacts, latestOf: made.latestOf });
    ctx.contribute("search.provider", {
      id: "artifacts", items: made.jumpItems,
      pick: (/** @type {ReturnType<typeof made.jumpItems>[number]} */ item) => item.run(),
    });
  },
};
