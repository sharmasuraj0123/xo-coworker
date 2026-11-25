// @ts-check
import { api } from "../../core/platform/api.js";
import { createChanges } from "./store.js";
import { createSavedSoon } from "./saved.js";
import { diff, jump } from "./diffview.js";
import { isImageChange, drawImageChange } from "./imagechange.js";

/** @import { ChangeData } from "./data-types" */

/** @type {import("../../core/kernel/types").ModuleDef} */
export const changeDataModule = {
  manifest: { id: "xo.change-data", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["world"], provides: ["changeData"] },
  activate(ctx) {
    const changes = createChanges({ world: ctx.use("world"), api, onChange: () => ctx.invalidate("workspace") });
    /** @type {ChangeData} */
    const data = { changes, save: createSavedSoon, diff, jump, isImageChange, drawImageChange };
    ctx.provide("changeData", data);
  },
};
