// @ts-check
import { createThreadPage } from "./thread-page.js";

/** @import { DockNeed, ThreadPageDeps, PanelComposer } from "./thread-page-types.d.ts" */

/** @import { ModuleDef } from "../../core/kernel/types.d.ts" */

/** @import { PageSpec } from "../../shell/panel/pages.js" */

/** @typedef {{ go(view: string, options: { panel: boolean }): void, closeAtCaret(composer: PanelComposer): void }} Navigation */

/** @template D @template {DockNeed} N @param {ThreadPageDeps<D, N> & Navigation} options */
export function createThreadPageModule(options) {
  const { TP, drawThreadPage, tpMount, tpShow, tpFocus, tpClose } = createThreadPage(options);
  /** @type {PageSpec & import("./session-types").ThreadPageEntry} */
  const page = {
    id: "thread", session: TP, shown: () => options.STAGE.pageShown?.name === "thread",
    title: (id) => options.convThread("t:" + id)?.title || "Thread",
    mount: tpMount, onShow: tpShow, focusEntry: tpFocus, close: tpClose,
    escape() {
      if (options.threadControls.menu()?.location === "page") { options.closeThreadMenu(); return true; }
      const composer = TP.K;
      if (!composer || document.activeElement !== composer.say) return false;
      if (!composer.at.hidden) options.closeAtCaret(composer);
      else { composer.say.blur(); TP.C?.scroller.focus({ preventScroll: true }); }
      return true;
    },
  };
  /** @type {ModuleDef} */
  const module = {
    manifest: { id: "xo.thread-page", version: "1.0.0", kernel: "^1.1.0", contributes: ["panel.page:thread"] },
    activate(ctx) {
      ctx.contribute("panel.page", page);
      ctx.on("app:decision-undone", (key) => TP.dock?.undoReceipt(key));
      /** @param {Event} event */
      function toMain({ target }) {
        const id = target instanceof Element && target.closest("[data-tp-main]")?.getAttribute("data-tp-main");
        if (!id) return;
        options.closeThreadMenu({ focus: false });
        options.STAGE.closePage("thread");
        options.go("t:" + id, { panel: true });
      }
      ctx.listen(document, "click", toMain);
    },
  };
  return { TP, drawThreadPage, module };
}
