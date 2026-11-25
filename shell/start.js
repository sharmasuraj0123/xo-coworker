// @ts-check

import { createScope } from "../core/kernel/scope.js";
import { PHONE } from "../core/platform/viewport.js";
import { keepTurning } from "../core/ui/motion.js";
import { drawSidebarControls } from "./frame-icons.js";

/** @param {import("./start-types.js").ShellStartup} startup */
export function startShell({ THEME, applyTheme, SIDE, PHONE, setDrawer, render, world, schedule, follow, loadDraft }) {
  const scope = createScope();
  try {
    applyTheme(THEME.get());
    drawSidebarControls();
    SIDE.fold(SIDE.folded, { quiet: true });
    scope.listen(PHONE, "change", () => { setDrawer(false); render(); });
    scope.effect(() => world.subscribe(schedule));
    scope.effect(keepTurning);
    follow();
    loadDraft();
    render();
    return scope.dispose;
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

/** @type {import("../core/kernel/types").ModuleDef} */
export const startupModule = {
  manifest: { id: "xo.startup", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["theme", "rail", "drawer", "world", "mainViewport", "composer"] },
  activate(ctx) {
    const phone = PHONE;
    if (!phone) throw new Error("The application requires media queries.");
    const setDrawer = ctx.use("drawer").set;
    ctx.on("app:view-preparing", () => setDrawer(false));
    ctx.on("app:started", () => ctx.effect(() => startShell({
      ...ctx.use("theme"), SIDE: ctx.use("rail").side, PHONE: phone, setDrawer, render: () => ctx.emit("app:render"),
      world: ctx.use("world"), schedule: () => ctx.invalidate("workspace"), follow: ctx.use("mainViewport").follow,
      loadDraft: ctx.use("composer").loadDraft,
    })));
  },
};
