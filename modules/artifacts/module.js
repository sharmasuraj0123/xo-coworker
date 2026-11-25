// @ts-check

import { createMade } from "./made.js";
import { madeSection } from "./section.js";
import { createScope } from "../../core/kernel/scope.js";

/** @import { ModuleDef } from "../../core/kernel/types.d.ts" */

/** @import { MadeDeps } from "./page-types.d.ts" */

/** @param {Pick<MadeDeps, "go" | "VW" | "skTile" | "skBar" | "rememberedMade">} host */
export function createArtifactsModule(host) {
  /** @type {ReturnType<typeof createMade> | undefined} */
  let catalog;
  /** @type {ModuleDef} */
  const module = {
    manifest: {
      id: "xo.artifacts", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "announce", "projectName"],
      contributes: ["home.section:hm-made", "page:artifacts", "search.provider:artifacts"],
    },
    activate(ctx) {
      const scope = createScope();
      ctx.effect(() => () => { catalog = undefined; scope.dispose(); });
      const made = createMade({
        ...host, scope, world: ctx.use("world"), PROJ: ctx.use("projectName"), announce: ctx.use("announce"),
        schedule: () => ctx.emit("app:render"),
      });
      catalog = made;
      ctx.contribute("home.section", madeSection(made));
      ctx.contribute("page", { id: "artifacts", mount: made.artifacts.mount, render: made.artifacts.render });
      ctx.contribute("search.provider", {
        id: "artifacts", items: made.jumpItems,
        pick: (/** @type {ReturnType<typeof made.jumpItems>[number]} */ item) => item.run(),
      });
    },
  };
  return {
    module,
    count: () => catalog?.artifacts.count() ?? 0,
    /** @param {string} thread @param {string | null} project */
    latestOf: (thread, project) => catalog?.latestOf(thread, project) ?? null,
  };
}
