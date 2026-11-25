// @ts-check
import { convOfChat, sessionOf } from "../../shell/place-context.js";
import { PHONE } from "../../core/platform/viewport.js";
import { createComposerSurface } from "./composer-surface.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const composerModule = {
  manifest: { id: "xo.composer", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["composer"], optional: ["files"],
    needs: ["stage", "world", "chats", "placeContext", "conversationSession", "notices", "announce", "navigation", "shape",
      "intelligence", "threadRuntime", "threadPresentation", "projectIcons", "currentView", "conversationPresentation", "runControls"],
    contributes: ["conversation.press:start", "conversation.press:retry", "conversation.press:edit",
      "conversation.press:remove-reference"] },
  activate(ctx) {
    if (!PHONE) throw new Error("The application requires media queries.");
    const session = ctx.use("conversationSession"), chats = ctx.use("chats"), place = ctx.use("placeContext");
    const notices = ctx.use("notices"), runs = ctx.use("runControls");
    const composer = createComposerSurface(ctx, {
      view: ctx.use("currentView"), session, localMessages: session.localMessages, world: ctx.use("world"), CH: chats,
      STAGE: ctx.use("stage"),
      PROJ: place.PROJ, chatOf: place.convProject, convOfChat, convThread: place.convThread, convProject: place.convProject,
      announce: ctx.use("announce"), heraldShow: notices.show, heraldFor: notices.forMsg, schedule: () => ctx.invalidate("workspace"),
      render: () => ctx.emit("app:render"), go: ctx.use("navigation").go, PHONE, isBusy: ctx.use("threadPresentation").isBusy,
      sendWhileRunning: ctx.use("threadRuntime").sendWhileRunning, noun: ctx.use("conversationPresentation").noun,
      IQ: ctx.use("intelligence").intelligence, sessionOf, running: runs.running, projects: place.projects,
      projectIcon: ctx.use("projectIcons").projectIcon, stopRun: runs.stopRun, SHAPE: ctx.use("shape"),
      VW: { open: (file, button) => ctx.optional("files")?.viewer.open(file, button) },
    });
    ctx.provide("composer", composer);
    ctx.effect(() => chats.attachRecovery(composer.putBack));
    ctx.on("app:view-leaving", () => composer.saveDraft());
    ctx.on("app:view-restoring", () => composer.loadDraft());
    ctx.on("app:intelligence-changed", () => {
      for (const input of session.focus.composers()) composer.chipRender(false, input);
    });
  },
};
