// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { createWorkspaceHeader } from "../../shell/workspace-header.js";
import { requireHtml } from "../../core/platform/dom.js";
import { mountMainDecoration } from "./main-decoration.js";
import { dockAtTop, watchDock } from "./dock-layout.js";
import { initFollow, fromTop, toRow } from "./follow.js";
import { conversationGestures } from "../../shell/gestures.js";
import { wordsOf } from "./words.js";
import { createReturnPill } from "../../shell/return-pill.js";
import { createLiveConversation } from "./live.js";
import { createReadingLayout } from "./reading-layout.js";
import { createConversationPaging } from "./paging.js";

/** @import { ViewportOptions, ViewportScope } from "./main-viewport-types.d.ts" */

/** @typedef {ReturnType<typeof mountMainViewport>} MainViewport */

/** @param {ViewportScope} scope @param {ViewportOptions} options */
function mountMainViewport(scope, { view, main: MAIN, takeFoldChange, heraldRoom, ...paging }) {
  const { scroller, msgs: msgsEl } = MAIN;
  const reading = createReadingLayout({ takeFoldChange, MAIN });
  const { loadAhead, loadOlderNow } = createConversationPaging({ ...paging, MAIN }, scope.signal);
  let scrolling = false;
  scope.listen(scroller, "scroll", () => {
    if (scrolling) return;
    scrolling = true;
    scope.frame(() => {
      scrolling = false;
      loadAhead();
      requireHtml("#top").classList.toggle("is-scrolled", fromTop() > 120);
    });
  }, { passive: true });
  watchDock(scope, { dock: requireHtml("#dock"), host: requireHtml("#app"), heraldRoom });
  scope.effect(initFollow);
  scope.effect(mountMainDecoration);
  const returnPill = createReturnPill(scope, { msgsEl, scroller, toRow });
  const live = createLiveConversation({ ...paging, view });
  return { ...live, returnPill, scroller, msgsEl, reading, loadAhead, loadOlderNow };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const mainViewportModule = {
  manifest: { id: "xo.main-viewport", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["mainViewport"],
    needs: ["conversationSession", "currentView", "placeContext", "world", "chats", "noticeLine", "toastLine"] },
  activate(ctx) {
    const scope = createScope();
    ctx.effect(() => scope.dispose);
    const session = ctx.use("conversationSession"), place = ctx.use("placeContext");
    const viewport = mountMainViewport(scope, {
      main: session.main, view: ctx.use("currentView"), takeFoldChange: session.folds.takeChange,
      heraldRoom: ctx.use("noticeLine").heraldRoom, CH: ctx.use("chats"), world: ctx.use("world"),
      convThread: place.convThread, chatOf: place.convProject, render: () => ctx.emit("app:render"),
    });
    conversationGestures({ scroller: viewport.scroller, msgs: viewport.msgsEl, say: session.composer.say,
      toast: ctx.use("toastLine") }, wordsOf, scope);
    ctx.on("app:view-visited", viewport.follow);
    ctx.on("workspace:layout", (view) => dockAtTop(view === "chats"));
    ctx.on("app:return-target", viewport.returnPill);
    ctx.provide("mainViewport", viewport);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const conversationContentModule = {
  manifest: { id: "xo.conversation-content", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["conversationContent"],
    needs: ["conversationSession", "mainViewport", "conversationHeader", "currentView", "placeContext"], optional: ["transcript"] },
  activate(ctx) {
    const session = ctx.use("conversationSession"), viewport = ctx.use("mainViewport"), header = ctx.use("conversationHeader");
    const workspaceHeader = createWorkspaceHeader(ctx.use("currentView"), ctx.use("placeContext").projects);
    ctx.provide("conversationContent", { draw(needs, gone) {
      header(needs);
      workspaceHeader();
      ctx.optional("transcript")?.(session.main, needs);
      if (gone && document.activeElement === session.composer.say) {
        const actions = viewport.msgsEl.querySelectorAll('.calm-act [data-go="home"]');
        const target = [...actions].find((el) => el instanceof HTMLElement && usable(el));
        (target instanceof HTMLElement ? target : session.region()).focus({ preventScroll: true });
      }
      ctx.frame(() => viewport.loadAhead(session.main));
    } });
  },
};
