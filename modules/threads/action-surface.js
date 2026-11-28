// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { menuKeys } from "../../core/ui/a11y/keynav.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { threadNotices } from "./notices.js";
import { createThreadMenu } from "./menu.js";
import { createThreadControls } from "./controls.js";
import { createThreadEditing } from "./editing.js";
import { createThreadDelete } from "./delete.js";
import { createThreadResolve } from "./resolve.js";
import { createThreadMenuActions } from "./menu-actions.js";
import { sessionOf } from "../../shell/place-context.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @type {ModuleDef} */
export const threadControlsModule = {
  manifest: { id: "xo.thread-controls", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["threadGroups", "shellDock", "threadRuntime", "threadPresentation"], provides: ["threadControls", "threadMenu"] },
  activate(ctx) {
    const controls = createThreadControls();
    ctx.on("app:view-preparing", controls.clear);
    ctx.provide("threadControls", controls);
    ctx.provide("threadMenu", createThreadMenu({
      panelThreads: ctx.use("threadGroups").panelThreads, SH: ctx.use("shellDock"), movable: ctx.use("threadRuntime").movable,
      isBusy: ctx.use("threadPresentation").isBusy,
    }));
  },
};

/** @type {ModuleDef} */
export const threadActionsModule = {
  manifest: { id: "xo.thread-actions", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "projectName", "currentView", "stage", "navigation", "redrawFocus",
      "notices", "conversationSession", "intelligence", "decisionPresentation", "threadControls"], provides: ["threadActions"],
    contributes: ["conversation.press:thread-menu"] },
  activate(ctx) {
    const world = ctx.use("world"), announce = ctx.use("announce"), view = ctx.use("currentView");
    const schedule = () => ctx.invalidate("workspace"), render = () => ctx.emit("app:render");
    const { go } = ctx.use("navigation"), { request: requestFocus } = ctx.use("redrawFocus");
    const { composerAt } = ctx.use("conversationSession").focus;
    const stage = ctx.use("stage"), intel = ctx.use("intelligence"), notices = ctx.use("notices");
    const { show: heraldShow, forMsg: heraldFor, drop: heraldDrop } = notices;
    const notice = threadNotices({
      movedHere: intel.intelligence.movedHere, waitSince: ctx.use("decisionPresentation").waitSince,
      show: heraldShow, find: world.thread, projectName: ctx.use("projectName"),
    });
    ctx.effect(() => world.onEvent((event) => { if (event.kind !== "message") notice(event); }));
    const resolve = createThreadResolve({ world, schedule, announce, heraldShow, heraldFor, heraldDrop, signal: ctx.signal });
    const controls = ctx.use("threadControls");
    const editing = createThreadEditing({ controls, world, render, schedule, announce, heraldShow, composerAt, requestFocus });
    const deletion = createThreadDelete({ world, render, view, go, announce, heraldShow, PROJ: ctx.use("projectName") });
    const close = editing.closeThreadMenu;
    ctx.effect(() => () => {
      controls.clear();
      editing.dispose();
      deletion.dispose();
      deletion.render(null);
      schedule();
    });
    ctx.effect(() => menuKeys(requireHtml("#top"), { close: () => close() }));
    editing.bind(requireHtml("#top"));
    const route = createThreadMenuActions({
      go, schedule, render, thread: world.thread, controls, editing, deletion, scope: ctx, resolve, heraldShow,
      closePage: () => stage.closePage("thread"), showThread: (id, input) => stage.show("thread", id, { focus: true, input }),
      openOtherRuntime: () => intel.openAlternate(sessionOf(view()), requireHtml("#iq", "button")),
    });
    ctx.provide("threadActions", { closeMenu: close, renderDelete: deletion.render });
    ctx.contribute("conversation.press", pressEntry("thread-menu", route));
  },
};
