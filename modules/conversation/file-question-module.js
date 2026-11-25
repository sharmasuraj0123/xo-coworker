// @ts-check
import { convOfChat } from "../../shell/place-context.js";
import { createFileQuestion } from "./file-question.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const fileQuestionsModule = {
  manifest: { id: "xo.file-questions", version: "1.0.0", kernel: "^1.1.0", core: true, optional: ["files"],
    needs: ["composer", "conversationSession", "currentView", "world", "projectName", "chats", "stage", "navigation",
      "announce", "notices"],
    provides: ["fileQuestions"] },
  activate(ctx) {
    const session = ctx.use("conversationSession");
    const { fileReferences, lrefRender, blockFor, refuse, deliverLive } = ctx.use("composer");
    const questions = createFileQuestion({
      view: ctx.use("currentView"), localMessages: session.localMessages, fileReferences, world: ctx.use("world"),
      PROJ: ctx.use("projectName"), convOfChat, CH: ctx.use("chats"), say: session.composer.say,
      VW: { close: (options) => ctx.optional("files")?.viewer.close(options) }, STAGE: ctx.use("stage"), go: ctx.use("navigation").go,
      announce: ctx.use("announce"), heraldShow: ctx.use("notices").show, schedule: () => ctx.invalidate("workspace"),
      blockFor, refuse, deliverLive, lrefRender,
    });
    ctx.provide("fileQuestions", { target: (file) => questions.askPlace(file)?.name ?? null,
      send: questions.askAboutLines, compose: questions.composeAbout, file: questions.askAboutFile });
  },
};
