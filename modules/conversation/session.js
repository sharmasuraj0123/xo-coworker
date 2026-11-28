// @ts-check

/** @typedef {ReturnType<typeof createConversationSession>} ConversationSession */
import { requireHtml } from "../../core/platform/dom.js";
import { pageEl } from "../../shell/place-context.js";
import { createConversationNavigation } from "./navigation.js";
import { createConv } from "./draw.js";
import { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } from "./follow.js";
import { createLocalMessages } from "./local-messages.js";
import { createTranscriptFolds } from "./transcript-folds.js";
import { createMainComposer } from "./main-composer.js";
import { createComposerFocus } from "./composer-focus.js";
import { PHONE } from "../../core/platform/viewport.js";

/** @import { ThreadPageAttachment } from "./session-types" */

/** @param {() => string} view @param {import("../../core/kernel/types").ModuleContext} ctx */
function createConversationSession(view, ctx) {
  const main = createConv({
    view, msgs: requireHtml("#msgs"), scroller: requireHtml("#scroller"),
    column: requireHtml("#column"), typing: requireHtml("#typing"), main: true,
    follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest },
  });
  /** @type {ThreadPageAttachment | undefined} */
  let threadPage;
  /** @param {ThreadPageAttachment} page */
  function attachPanel(page) {
    if (threadPage) throw new Error("The thread composer is already attached");
    threadPage = page;
    return () => { if (threadPage === page) threadPage = undefined; };
  }
  const panel = () => threadPage?.session;
  const composer = createMainComposer(view, main);
  const focus = createComposerFocus({
    main: composer, isThread: () => threadPage?.shown() ?? false,
    coversChat: () => document.body.classList.contains("stage-full") || !!PHONE?.matches,
    panel() {
      const thread = panel();
      return thread?.K && thread.box ? { composer: thread.K, host: thread.box } : null;
    },
  }, () => ctx.invalidate("workspace"));
  /** @param {Node | null} element */
  function conversationAt(element) {
    const thread = panel();
    return thread?.C && thread.box?.contains(element) ? thread.C : main;
  }
  const localMessages = createLocalMessages(), folds = createTranscriptFolds();
  const region = () => pageEl(view()) || main.scroller;
  const { showMsg } = createConversationNavigation(ctx, { alias: localMessages.alias, main: () => main });
  return { main, showMsg, attachPanel, panel, conversationAt, localMessages, folds, region, composer, focus };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const conversationSessionModule = {
  manifest: { id: "xo.conversation-session", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["currentView"], provides: ["conversationSession"] },
  activate(ctx) {
    const session = createConversationSession(ctx.use("currentView"), ctx);
    ctx.effect(() => session.focus.dispose);
    ctx.provide("conversationSession", session);
  },
};
