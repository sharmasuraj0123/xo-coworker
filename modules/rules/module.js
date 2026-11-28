// @ts-check

import { createRulesPage } from "./page.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const rulesModule = {
  manifest: { id: "xo.rules", version: "1.0.0", kernel: "^1.1.0", needs: ["settings", "world", "announce", "projectName"] },
  activate(ctx) {
    const settings = ctx.use("settings");
    const page = createRulesPage(settings, { world: ctx.use("world"), announce: ctx.use("announce"), PROJ: ctx.use("projectName") });
    ctx.effect(() => page.dispose);
    ctx.effect(() => settings.bindPage("rules", page));
  },
};
