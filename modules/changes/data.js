// @ts-check
import { api } from "../../core/platform/api.js";
import { createChanges } from "./store.js";
import { createSavedSoon } from "./saved.js";
import { diff, jump, setTheme } from "./diffview.js";
import { isImageChange, drawImageChange } from "./imagechange.js";

/** @import { ChangeData } from "./data-types" */

/** @import { ModuleDef, Services } from "../../core/kernel/types" */

/** @param {Services["world"]} world @param {() => void} onChange */
export function createChangeData(world, onChange) {
  const changes = createChanges({ world, api, onChange });
  /** @type {ModuleDef} */
  const module = {
    manifest: { id: "xo.change-data", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["changeData"] },
    activate(ctx) {
      /** @type {ChangeData} */
      const data = { changes, save: createSavedSoon, diff, jump, isImageChange, drawImageChange };
      ctx.provide("changeData", data);
    },
  };
  return { changes, setTheme, module };
}
