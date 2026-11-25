// @ts-check

import { createChangesFrame } from "./frame.js";
import { setTheme } from "./diffview.js";

/** @import { ChangesFrameOptions } from "../../shell/panel/panel-types.d.ts" */

/** @param {Parameters<typeof createChangesFrame>[0]["changes"]} changes @returns {import("../../core/kernel/types").ModuleDef} */
export function createChangesModule(changes) {
  return {
    manifest: { id: "xo.changes", version: "1.0.0", kernel: "^1.1.0", contributes: ["panel.frame:changes"] },
    activate(ctx) {
      ctx.contribute("panel.frame", {
        id: "changes", title: "Changes", theme: setTheme,
        /** @param {HTMLElement} host @param {ChangesFrameOptions} options */
        mount: (host, options) => createChangesFrame({ host, changes, ...options }),
      });
    },
  };
}
