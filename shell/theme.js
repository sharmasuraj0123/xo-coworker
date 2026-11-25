// @ts-check
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const themeModule = {
  manifest: { id: "xo.theme", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["announce"], provides: ["theme"] },
  activate(ctx) {
    const theme = createTheme(ctx, (mode) => ctx.emit("theme:applied", mode));
    wireThemeToggle(ctx, theme.applyTheme, ctx.use("announce"));
    ctx.provide("theme", theme);
  },
};
