// @ts-check

import { createScope } from "../core/kernel/scope.js";
import { keepTurning } from "../core/ui/motion.js";
import { drawSidebarControls } from "./frame-icons.js";

/** @param {import("./start-types.js").ShellStartup} startup */
export function startShell({ THEME, applyTheme, SIDE, soundRender, PHONE, setDrawer, render, world, schedule, follow, loadDraft }) {
  const scope = createScope();
  try {
    applyTheme(THEME.get());
    drawSidebarControls();
    SIDE.fold(SIDE.folded, { quiet: true });
    soundRender();
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
