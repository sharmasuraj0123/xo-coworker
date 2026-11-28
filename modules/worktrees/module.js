// @ts-check

import { createWorktreesPage } from "./page.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const worktreesModule = {
  manifest: { id: "xo.worktrees", version: "1.0.0", kernel: "^1.1.0", needs: ["settings", "world", "announce", "projectName"] },
  activate(ctx) {
    const settings = ctx.use("settings");
    const page = createWorktreesPage(settings, { world: ctx.use("world"), announce: ctx.use("announce"), PROJ: ctx.use("projectName") });
    ctx.effect(() => page.dispose);
    ctx.effect(() => settings.bindPage("worktrees", page));
  },
};
