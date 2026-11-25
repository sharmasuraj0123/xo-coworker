// @ts-check
import { createShapeView } from "./shape-page.js";
import { createShapeApply } from "./apply-shape.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const shapeViewModule = {
  manifest: { id: "xo.shape-view", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["shape", "announce", "currentView", "placeContext", "world", "mainViewport", "conversationPresentation", "shellDock", "stage"],
    provides: ["shapeView"] },
  activate(ctx) {
    const shape = ctx.use("shape"), view = createShapeView({ shape, announce: ctx.use("announce") });
    const apply = createShapeApply({
      SV: view, SHAPE: shape, view: ctx.use("currentView"), convThread: ctx.use("placeContext").convThread,
      world: ctx.use("world"), loadChatHops: ctx.use("mainViewport").loadChatHops,
      setWorkMode: ctx.use("conversationPresentation").setWorkMode,
      SH: ctx.use("shellDock"), STAGE: ctx.use("stage"), schedule: () => ctx.invalidate("workspace"),
    });
    ctx.effect(() => shape.onChange(apply));
    apply({ boot: true });
    ctx.provide("shapeView", view);
  },
};
