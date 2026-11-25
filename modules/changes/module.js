// @ts-check

import { createChangeChipRoute } from "./chip-route.js";
import { createChangesFrame } from "./frame.js";
import { setTheme } from "./diffview.js";

/** @import { ChangesFrameOptions } from "../../shell/panel/panel-types.d.ts" */

/** @import { ModuleDef } from "../../core/kernel/types.d.ts" */

/** @import { ChipRoute } from "./chip-route-types.d.ts" */

/** @param {Omit<ChipRoute, "changes" | "schedule">} routing @returns {ModuleDef} */
export function createChangesModule(routing) {
  return {
    manifest: { id: "xo.changes", version: "1.0.0", kernel: "^1.1.0",
      needs: ["changeData"], contributes: ["panel.frame:changes", "conversation.file-route:change-chip"] },
    activate(ctx) {
      const { changes } = ctx.use("changeData");
      const route = createChangeChipRoute({ ...routing, changes, schedule: () => ctx.emit("app:render") });
      ctx.contribute("conversation.file-route", { id: "change-chip", priority: 1, route });
      ctx.contribute("panel.frame", {
        id: "changes", title: "Changes", theme: setTheme,
        /** @param {HTMLElement} host @param {ChangesFrameOptions} options */
        mount: (host, options) => createChangesFrame({ host, changes, ...options }),
      });
    },
  };
}
