// @ts-check
import { createApplicationShape } from "./application.js";

/** @type {import("../../kernel/types").ModuleDef} */
export const shapeModule = {
  manifest: { id: "xo.shape", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["world", "notices"],
    provides: ["shape", "terminalCapability"] },
  activate(ctx) {
    const notices = ctx.use("notices");
    const app = createApplicationShape({ scope: ctx, events: ctx.use("world"),
      notice: (notice) => notices.show({ kind: "calm", ...notice }, 6000) });
    ctx.provide("shape", app.shape);
    ctx.provide("terminalCapability", app.terminal);
  },
};
