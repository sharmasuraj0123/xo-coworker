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

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @param {import("./action-surface-types").ThreadActionOptions} options */
export function createThreadActions(options) {
  const controls = createThreadControls();
  /** @type {ReturnType<typeof createThreadEditing> | undefined} */
  let editing;
  /** @type {ReturnType<typeof createThreadDelete> | undefined} */
  let deletion;
  /** @type {ModuleDef} */
  const module = {
    manifest: { id: "xo.thread-actions", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "announce", "projectName", "currentView"], contributes: ["conversation.press:thread-menu"] },
    activate(ctx) {
      const world = ctx.use("world"), announce = ctx.use("announce"), view = ctx.use("currentView");
      const { schedule, render, notices, go, requestFocus, composerAt } = options;
      const { show: heraldShow, forMsg: heraldFor, drop: heraldDrop } = notices;
      const notice = threadNotices({ ...options.notice(), show: heraldShow, find: world.thread, projectName: ctx.use("projectName") });
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
        ...options, thread: world.thread, controls, editing, deletion, scope: ctx, resolve, heraldShow });
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
