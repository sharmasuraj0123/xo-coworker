// @ts-check
import { $ } from "../../core/platform/dom.js";
import { menuKeys } from "../../core/ui/a11y/keynav.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { threadNotices } from "./notices.js";
import { createThreadControls } from "./controls.js";
import { createThreadEditing } from "./editing.js";
import { createThreadDelete } from "./delete.js";
import { createThreadResolve } from "./resolve.js";
import { createThreadMenuActions } from "./menu-actions.js";
import { sessionOf } from "../../shell/place-context.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

export function createThreadActions() {
  const controls = createThreadControls();
  /** @type {ReturnType<typeof createThreadEditing> | undefined} */
  let editing;
  /** @type {ReturnType<typeof createThreadDelete> | undefined} */
  let deletion;
  /** @type {ModuleDef} */
  const module = {
    manifest: { id: "xo.thread-actions", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "announce", "projectName", "currentView", "stage", "navigation", "redrawFocus",
        "notices", "conversationSession", "intelligence", "decisionPresentation"], contributes: ["conversation.press:thread-menu"] },
    activate(ctx) {
      const world = ctx.use("world"), announce = ctx.use("announce"), view = ctx.use("currentView");
      const schedule = () => ctx.emit("app:render"), render = () => ctx.emit("app:paint");
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
      editing = createThreadEditing({ controls, world, render, schedule, announce, heraldShow, composerAt, requestFocus });
      deletion = createThreadDelete({ world, render, view, go, announce, heraldShow, PROJ: ctx.use("projectName") });
      const close = editing.closeThreadMenu;
      ctx.effect(() => () => {
        controls.clear();
        editing?.dispose();
        deletion?.dispose();
        deletion?.render(null);
        editing = undefined;
        deletion = undefined;
        schedule();
      });
      ctx.effect(() => menuKeys($("#top"), { close: () => close() }));
      editing.bind($("#top"));
      const route = createThreadMenuActions({
        go, schedule, render, thread: world.thread, controls, editing, deletion, scope: ctx, resolve, heraldShow,
        closePage: () => stage.closePage("thread"), showThread: (id, input) => stage.show("thread", id, { focus: true, input }),
        openOtherRuntime: () => intel.openAlternate(sessionOf(view()), $("#iq")),
      });
      ctx.contribute("conversation.press", pressEntry("thread-menu", route));
    },
  };
  return {
    module, controls,
    /** @param {{ focus?: boolean }} [opts] */
    closeMenu(opts) { editing?.closeThreadMenu(opts); },
    /** @param {Parameters<NonNullable<typeof deletion>["render"]>[0]} thread */
    renderDelete(thread) { deletion?.render(thread); },
  };
}
