// @ts-check
import { createThreadPage } from "./thread-page.js";

import { sessionOf } from "../../shell/place-context.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const threadPageModule = {
  manifest: { id: "xo.thread-page", version: "1.0.0", kernel: "^1.1.0", provides: ["threadPage"],
    optional: ["threadActions", "transcript"], contributes: ["panel.page:thread"],
    needs: ["world", "navigation", "conversationSession", "stage", "threadControls", "decisionPresentation", "decisionDock",
      "composer", "intelligence", "placeContext", "noticeLine", "toastLine", "mainViewport", "threadPresentation", "threadRuntime",
      "threadMenu", "checklist"] },
  activate(ctx) {
    const session = ctx.use("conversationSession"), stage = ctx.use("stage"), controls = ctx.use("threadControls");
    const dock = ctx.use("decisionDock"), composer = ctx.use("composer"), place = ctx.use("placeContext"), viewport = ctx.use("mainViewport");
    const { TP, drawThreadPage, tpMount, tpShow, tpFocus, tpClose } = createThreadPage({
      STAGE: stage, threadControls: controls, world: ctx.use("world"), D: ctx.use("decisionPresentation").D,
      createDock: dock.createDock, dockDeps: dock.deps, ...composer,
      closeThreadMenu: (options) => ctx.optional("threadActions")?.closeMenu(options), toggleIq: ctx.use("intelligence").toggle,
      sessionOf, convProject: place.convProject, heraldRoom: ctx.use("noticeLine").heraldRoom, toastLine: ctx.use("toastLine"),
      loadAhead: viewport.loadAhead, returnPill: viewport.returnPill, convThread: place.convThread, ...ctx.use("threadPresentation"),
      rtTag: ctx.use("threadRuntime").rtTag, threadMenuHtml: ctx.use("threadMenu"), checklistRender: ctx.use("checklist").render,
      drawConv: (conversation, needs) => ctx.optional("transcript")?.(conversation, needs),
    });
    const shown = () => stage.pageShown?.name === "thread";
    ctx.effect(() => session.attachPanel({ session: TP, shown }));
    ctx.contribute("panel.page", {
      id: "thread", title: (id) => place.convThread("t:" + id)?.title || "Thread",
      mount: tpMount, onShow: tpShow, focusEntry: tpFocus, close: tpClose,
      escape() {
        if (controls.menu()?.location === "page") { ctx.optional("threadActions")?.closeMenu(); return true; }
        const field = TP.K;
        if (!field || document.activeElement !== field.say) return false;
        if (!field.at.hidden) composer.mentions.closeAtCaret(field);
        else { field.say.blur(); TP.C?.scroller.focus({ preventScroll: true }); }
        return true;
      },
    });
    ctx.provide("threadPage", { draw(needs) {
      if (TP.C && TP.tid && !TP.wait && shown()) drawThreadPage(needs);
    } });
    ctx.on("app:decision-undone", (key) => TP.dock?.undoReceipt(key));
    const { go } = ctx.use("navigation");
    ctx.listen(document, "click", ({ target }) => {
      const id = target instanceof Element && target.closest("[data-tp-main]")?.getAttribute("data-tp-main");
      if (!id) return;
      ctx.optional("threadActions")?.closeMenu({ focus: false });
      stage.closePage("thread");
      go("t:" + id, { panel: true });
    });
  },
};
