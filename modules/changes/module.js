// @ts-check
import { createChangeChipRoute } from "./chip-route.js";
import { createChangesFrame } from "./frame.js";
import { setTheme } from "./diffview.js";

/** @import { ChangesFrameOptions } from "../../shell/panel/panel-types.d.ts" */

/** @type {import("../../core/kernel/types").ModuleDef} */
export const changesModule = {
  manifest: { id: "xo.changes", version: "1.0.0", kernel: "^1.1.0",
    needs: ["changeData", "conversationSession", "stage", "redrawFocus"],
    contributes: ["panel.frame:changes", "conversation.file-route:change-chip"] },
  activate(ctx) {
    const { changes } = ctx.use("changeData");
    const route = createChangeChipRoute({
      changes, schedule: () => ctx.emit("app:render"), conversationAt: ctx.use("conversationSession").conversationAt,
      showChange: ctx.use("stage").showChange, focusAfterDraw: ctx.use("redrawFocus").request,
      openFile: (file, from) => ctx.emit("app:open-file", { file, from }),
    });
    ctx.contribute("conversation.file-route", { id: "change-chip", priority: 1, route });
    ctx.contribute("panel.frame", {
      id: "changes", title: "Changes", theme: setTheme,
      /** @param {HTMLElement} host @param {ChangesFrameOptions} options */
      mount: (host, options) => createChangesFrame({ host, changes, ...options }),
    });
  },
};
