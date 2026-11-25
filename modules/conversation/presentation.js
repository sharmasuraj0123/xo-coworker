// @ts-check
import { mountConversationMarkdown, WEBPICS } from "./markdown.js";
import { createChecklistRenderer } from "./checklist.js";
import { createFileRoute } from "../../core/services/file-route.js";
import { turnHtml, turnAv, setWorkMode } from "./blocks/turn.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const conversationPresentationModule = {
  manifest: { id: "xo.conversation-presentation", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["currentView", "placeContext", "shape"], provides: ["conversationPresentation"] },
  activate(ctx) {
    const fileRoute = createFileRoute({ currentView: ctx.use("currentView"), convThread: ctx.use("placeContext").convThread });
    const noun = mountConversationMarkdown(ctx, ctx.use("shape"), fileRoute);
    ctx.provide("conversationPresentation", { fileRoute, noun, turnHtml, turnAv, setWorkMode, webPictures: WEBPICS });
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const checklistModule = {
  manifest: { id: "xo.checklist", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["currentView", "placeContext", "shape"], provides: ["checklist"] },
  activate(ctx) {
    ctx.provide("checklist", createChecklistRenderer({ view: ctx.use("currentView"), scope: ctx,
      SHAPE: ctx.use("shape"), convThread: ctx.use("placeContext").convThread, places: ctx.places,
      schedule: () => ctx.invalidate("workspace"),
    }));
  },
};
