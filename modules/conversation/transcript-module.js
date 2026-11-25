// @ts-check
import { youText } from "./file-reference-text.js";
import { createConversationMessages } from "./messages.js";
import { heldWords } from "../../core/services/world/held.js";
import { convOfChat } from "../../shell/place-context.js";
import { tickElapsed } from "../../shell/elapsed.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { transcriptActions } from "./transcript-actions.js";
import { createTyping } from "./typing.js";
import { createMessageDetails } from "./message-details.js";
import { createMessageItems } from "./message-items.js";
import { createConversationDrawing } from "./draw.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const transcriptModule = {
  manifest: { id: "xo.transcript", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "shape", "placeContext", "decisionPresentation", "threadPresentation", "changeData", "messageContext",
      "conversationSession", "threadRuntime", "composer", "chats", "decisionDock", "stage", "conversationPresentation",
      "mainViewport", "runControls", "noticeLine", "checklist", "redrawFocus"], provides: ["transcript"],
    optional: ["artifactCatalog"],
    contributes: ["conversation.press:older", "conversation.press:fold", "conversation.press:checklist",
      "conversation.press:interrupt"] },
  activate(ctx) {
    const world = ctx.use("world"), shape = ctx.use("shape"), place = ctx.use("placeContext");
    const decision = ctx.use("decisionPresentation"), status = ctx.use("threadPresentation");
    const { changes: CHG } = ctx.use("changeData");
    const session = ctx.use("conversationSession"), runtime = ctx.use("threadRuntime"), viewport = ctx.use("mainViewport");
    const runs = ctx.use("runControls"), chats = ctx.use("chats"), presentation = ctx.use("conversationPresentation");
    const { localMessages, folds } = session;
    const schedule = () => ctx.invalidate("workspace");
    const messagesOf = createConversationMessages({
      ...place, world, shape, D: decision.D, localMessages, chatOf: place.convProject });
    const context = ctx.use("messageContext");
    const typing = createTyping({
      world, CH: chats, PROJ: place.PROJ, convThread: place.convThread, chatOf: place.convProject, isBusy: status.isBusy,
      openAsk: context.openAsk, heldWords, schedule, tick: tickElapsed,
      sendingTo(chat) {
        return localMessages.list(convOfChat(chat)).find(
          (row) => row.who === "you" && row.status === "sending" && row.target === chat) ?? null;
      },
    }, ctx);
    const details = createMessageDetails({
      REC: { latestOf(thread, project) {
        return ctx.optional("artifactCatalog")?.latestOf(thread, project) ?? null;
      } },
      ...place, ...status, ...decision, world, SHAPE: shape, aliases: localMessages.aliases,
      ...runtime, ...runs, noun: presentation.noun });
    const items = createMessageItems({ ...place, ...context, ...details, world, CHG, messagesOf, youText,
      CH: chats, STAGE: ctx.use("stage"), limitStatus: ctx.use("decisionDock").limitStatus, transcriptOpen: folds.open,
      startHtml: ctx.use("composer").startHtml, fileRoute: presentation.fileRoute });
    const draw = createConversationDrawing({ ...viewport.reading, ensureRoot: viewport.ensureRoot, liveReady: viewport.liveReady,
      CHG, msgItems: items.msgItems, typingRender: typing.render });
    const checklist = ctx.use("checklist");
    const routes = transcriptActions({
      convAt: session.conversationAt, loadOlderNow: viewport.loadOlderNow, transcriptFolds: folds, schedule,
      toggleChecklist: checklist.toggle, checklistRender: checklist.render, requestFocus: ctx.use("redrawFocus").request,
      heraldBox: ctx.use("noticeLine").heraldBox, interruptRun: runs.interruptRun,
      needs: decision.D.needItems, convThread: place.convThread,
    });
    for (const [id, route] of Object.entries(routes)) {
      const key = /** @type {import("../../shell/conversation-press-types").PressId} */ (id);
      ctx.contribute("conversation.press", pressEntry(key, route));
    }
    ctx.provide("transcript", draw);
  },
};
