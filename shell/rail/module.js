// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { createSide } from "./side.js";
import { createSideRows } from "./rows.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const railModule = {
  manifest: { id: "xo.rail", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["shape", "announce", "currentView", "world", "chats", "decisionPresentation",
      "placeContext", "threadPresentation", "projectIcons"],
    optional: ["jump"], provides: ["rail"] },
  activate(ctx) {
    const jump = requireHtml("#jump");
    const side = createSide({ scope: ctx, shape: ctx.use("shape"), announce: ctx.use("announce"), render: () => ctx.emit("app:render"),
      toggleJump() { const surface = ctx.optional("jump"); if (jump.hidden) surface?.open(); else surface?.close(); } });
    const { D, askShort } = ctx.use("decisionPresentation"), place = ctx.use("placeContext");
    const rows = createSideRows(ctx, {
      view: ctx.use("currentView"), world: ctx.use("world"), CH: ctx.use("chats"), D,
      projects: place.projects, convThread: place.convThread,
      ...ctx.use("threadPresentation"), askShort, projectIcon: ctx.use("projectIcons").projectIcon, folded: () => side.folded,
    });
    ctx.provide("rail", { side, rows });
  },
};
