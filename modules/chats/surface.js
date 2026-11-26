// @ts-check
import { sheetGesture } from "../../shell/gestures.js";
import { ownLayer } from "../../shell/layers.js";

import { PHONE } from "../../core/platform/viewport.js";
import { sessionOf } from "../../shell/place-context.js";
import { requireHtml } from "../../core/platform/dom.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { replyNotices } from "./reply-notices.js";
import { createChats } from "./chats.js";
import { bindChatControls } from "./controls.js";
import { cliName } from "../../core/services/world/conn.js";
import { chatOrder } from "../../core/services/world/conversation.js";
import { heldShort, heldBadge } from "../../core/services/world/held.js";
import { dayGroup, rowTime } from "../../core/services/world/list-time.js";

/** @import { ChatButtons } from "./surface-types.d.ts" */

/** @type {import("../../core/kernel/types").ModuleDef} */
export const chatModelModule = {
  manifest: { id: "xo.chat-model", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "announce", "notices", "navigation", "currentView", "conversationSession", "conversationPresentation"],
    optional: ["composer"], provides: ["chats"] },
  activate(ctx) {
    const session = ctx.use("conversationSession"), view = ctx.use("currentView"), { go } = ctx.use("navigation");
    const { turnHtml, turnAv } = ctx.use("conversationPresentation");
    const chats = createChats({
      world: ctx.use("world"), announce: ctx.use("announce"), heraldShow: ctx.use("notices").show, go,
      schedule: () => ctx.invalidate("workspace"), view, listRoot: requireHtml("#msgs"), transcriptOpen: session.folds.open,
      restore(text, { force = false } = {}) {
        const composer = ctx.optional("composer");
        if (!composer) return false;
        if (force && view() !== "chats") go("chats");
        if (view() !== "chats" || (!force && session.composer.say.value.trim())) return false;
        composer.putBack(text);
        return true;
      },
    }, { turnHtml, turnAv, cliName, chatOrder, heldShort, heldBadge, dayGroup, rowTime });
    ctx.effect(() => chats.dispose);
    ownLayer(ctx, { id: "chat-setup", open: () => chats.setupOpen, close: () => { chats.closeSetup(); } });
    ctx.provide("chats", chats);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const chatControlsModule = {
  manifest: { id: "xo.chat-controls", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "projectName", "currentView", "announce", "notices", "conversationSession", "chats",
      "intelligence", "composer", "runControls"],
    contributes: ["conversation.press:chat-message"] },
  activate(ctx) {
    if (!PHONE) throw new Error("Chat controls need media queries");
    const phone = PHONE, view = ctx.use("currentView"), session = ctx.use("conversationSession");
    const chats = ctx.use("chats"), { updateComposer, putBack, liveBlock, refuse, mentions } = ctx.use("composer");
    const composer = () => session.composer.say;
    const stop = ctx.use("runControls").stopRun, intel = ctx.use("intelligence");
    /** @param {ChatButtons} buttons */
    function bindComposerButtons({ scope, target, permissions, intelligence, aim, toggleIntelligence }) {
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
        const block = liveBlock();
        if (block) { refuse(block, "the message stays, to retry"); return true; }
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
      stop(session.conversationAt(target).view);
      return true;
    }

    bindComposerButtons({
      scope: ctx, target: requireHtml("#target", "button"), permissions: requireHtml("#cs-perm", "button"),
      intelligence: requireHtml("#iq", "button"),
      updateComposer, aim: () => mentions.aim(session.composer), toggleIntelligence: (v, chip) => intel.toggle(sessionOf(v), chip),
    });
    const setup = requireHtml("#cs-pop");
    sheetGesture(ctx, { host: setup, open: () => chats.setupOpen && setup.classList.contains("is-sheet"),
      close: () => { chats.closeSetup(); updateComposer(); } });
    bindChatControls({ scope: ctx, list: requireHtml("#msgs"), chats, scroller: requireHtml("#scroller"),
      greeting: requireHtml("#cs-hi"), setup: requireHtml("#cs-pop"), phone, updateComposer });
    const reply = replyNotices(
      view, ctx.use("projectName"), ctx.use("notices").show, ctx.use("announce"), () => ctx.invalidate("workspace"));
    ctx.effect(() => ctx.use("world").onEvent(reply));
    ctx.contribute("conversation.press", pressEntry("chat-message", handleMessageAction));
  },
};
