import { keepTurning } from "../core/ui/motion.js";
import { drawSidebarControls } from "./frame-icons.js";

/** @param {import("./start-types.js").ShellStartup} startup */
export function startShell({ THEME, applyTheme, SIDE, soundRender, PHONE, setDrawer, render, world, schedule, follow, loadDraft }) {
  applyTheme(THEME.get());
  drawSidebarControls();
  SIDE.fold(SIDE.folded, { quiet: true });
  soundRender();
  PHONE.addEventListener("change", () => { setDrawer(false); render(); });

  world.subscribe(() => schedule());
  keepTurning();
  follow();
  loadDraft();
  render();
}
