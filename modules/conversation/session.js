// @ts-check
import { $ } from "../../core/platform/dom.js";
import { pageEl } from "../../shell/place-context.js";
import { createConv } from "./draw.js";
import { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } from "./follow.js";
import { createLocalMessages } from "./local-messages.js";
import { createTranscriptFolds } from "./transcript-folds.js";
import { createMainComposer } from "./main-composer.js";
import { createComposerFocus } from "./composer-focus.js";
import { PHONE } from "../../core/platform/viewport.js";

/** @import { ThreadPageEntry } from "./session-types" */

/** @param {() => string} view @param {Pick<import("../../core/kernel/types").Places, "get">} places @param {() => void} schedule */
export function createConversationSession(view, places, schedule) {
  const main = createConv({
    view, msgs: $("#msgs"), scroller: $("#scroller"), column: $("#column"), typing: $("#typing"), main: true,
    follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest },
  });
  const page = () => /** @type {ThreadPageEntry | undefined} */ (places.get("panel.page", "thread"));
  const panel = () => page()?.session;
  const composer = createMainComposer(view, main);
  const focus = createComposerFocus({
    main: composer, isThread: () => page()?.shown() ?? false,
    coversChat: () => document.body.classList.contains("stage-full") || !!PHONE?.matches,
    panel() {
      const thread = panel();
      return thread?.K && thread.box ? { composer: thread.K, host: thread.box } : null;
    },
  }, schedule);
  /** @param {Node | null} element */
  function conversationAt(element) {
    const thread = panel();
    return thread?.C && thread.box?.contains(element) ? thread.C : main;
  }
  const localMessages = createLocalMessages(), folds = createTranscriptFolds();
  const region = () => pageEl(view()) || main.scroller;
  const session = { main, panel, conversationAt, localMessages, folds, region, composer, focus };
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.conversation-session", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["conversationSession"] },
    activate(ctx) { ctx.effect(() => focus.dispose); ctx.provide("conversationSession", session); },
  };
  return { session, module };
}
