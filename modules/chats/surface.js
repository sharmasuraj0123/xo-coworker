// @ts-check

import { $ } from "../../core/platform/dom.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { replyNotices } from "./reply-notices.js";
import { createChats } from "./chats.js";
import { bindChatControls } from "./controls.js";
import { cliName } from "../../core/services/world/conn.js";
import { chatOrder } from "../../core/services/world/conversation.js";
import { heldShort, heldBadge } from "../../core/services/world/held.js";
import { dayGroup, rowTime } from "../../core/services/world/list-time.js";

/** @import { Conversation } from "./types.d.ts" */

/** @import { ChatControls } from "./controls-types.d.ts" */

/** @import { ChatButtons, ChatSurfaceOptions } from "./surface-types.d.ts" */

/** @param {ChatSurfaceOptions} options @param {Pick<Conversation, "turnHtml" | "turnAv">} conversation */
export function createChatSurface(options, conversation) {
  const { world, announce, heraldShow, go, schedule, view, transcriptOpen, composer, putBack, stop } = options;
  const list = $("#msgs");
  const chats = createChats({
    world, announce, heraldShow, go, schedule, view, listRoot: list, transcriptOpen,
    restore(text, { force = false } = {}) {
      if (force && view() !== "chats") go("chats");
      if (view() !== "chats" || (!force && composer().value.trim())) return false;
      putBack(text);
      return true;
    },
  }, { ...conversation, cliName, chatOrder, heldShort, heldBadge, dayGroup, rowTime });

  /** @param {Omit<ChatControls, "list" | "chats">} controls */
  function mountControls(controls) {
    bindChatControls({ ...controls, list, chats });
  }

  /** @param {ChatButtons} buttons */
  function bindComposerButtons({ scope, target, permissions, sendNow, intelligence, updateComposer, aim, toggleIntelligence }) {
    /** @param {HTMLElement} anchor @param {string} part */
    function setup(anchor, part) {
      chats.toggleSetup(anchor, part);
      updateComposer();
    }
    scope.listen(target, "click", () => {
      const active = view();
      if (active === "chats") setup(target, "cwd");
      else if (active.startsWith("c:")) composer().focus();
      else aim();
    });
    scope.listen(permissions, "click", () => { if (view() === "chats") setup(permissions, "mode"); });
    scope.listen(sendNow, "click", () => {
      chats.toggleNow(view());
      updateComposer();
      composer().focus();
    });
    scope.listen(intelligence, "click", () => {
      const active = view();
      if (active === "chats") setup(intelligence, "model");
      else if (!chats.isChats(active)) toggleIntelligence(active, intelligence);
    });
  }

  /** @param {Element} target */
  function handleMessageAction(target) {
    const confirmation = target.closest("[data-chc]");
    const choice = confirmation?.getAttribute("data-chc");
    if (confirmation && choice) {
      const focused = confirmation.contains(confirmation.ownerDocument.activeElement);
      chats.resolveConfirm(view(), choice);
      if (focused) composer().focus({ preventScroll: true });
      return true;
    }
    const retry = target.closest("[data-chat-retry]");
    const retryId = retry?.getAttribute("data-chat-retry");
    if (retry && retryId) {
      const block = options.retryBlock();
      if (block) { options.refuse(block, "the message stays, to retry"); return true; }
      const focused = retry.contains(retry.ownerDocument.activeElement);
      chats.retry(retryId);
      if (focused) composer().focus({ preventScroll: true });
      return true;
    }
    const editId = target.closest("[data-chat-edit]")?.getAttribute("data-chat-edit");
    if (editId) {
      const text = chats.edit(editId);
      if (text != null) putBack(text);
      return true;
    }
    if (!target.closest("[data-chat-stop]")) return false;
    stop(target);
    return true;
  }

  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.chat-controls", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "projectName", "currentView", "announce"], contributes: ["conversation.press:chat-message"] },
    activate(ctx) {
      const { updateComposer, aim, toggleIntelligence, phone } = options;
      bindComposerButtons({
        scope: ctx, target: $("#target"), permissions: $("#cs-perm"), sendNow: $("#send-now"), intelligence: $("#iq"),
        updateComposer, aim, toggleIntelligence,
      });
      mountControls({ scope: ctx, scroller: $("#scroller"), greeting: $("#cs-hi"), setup: $("#cs-pop"), phone, updateComposer });
      const reply = replyNotices(ctx.use("currentView"), ctx.use("projectName"), heraldShow, ctx.use("announce"), schedule);
      ctx.effect(() => ctx.use("world").onEvent(reply));
      ctx.contribute("conversation.press", pressEntry("chat-message", handleMessageAction));
    },
  };
  return { chats, module };
}
