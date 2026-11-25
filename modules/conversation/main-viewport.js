// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { requireHtml } from "../../core/platform/dom.js";
import { mountMainDecoration } from "./main-decoration.js";
import { watchDock } from "./dock-layout.js";
import { initFollow, fromTop, toRow } from "./follow.js";
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
    needs: ["conversationSession", "currentView", "placeContext", "world", "chats", "noticeLine"] },
  activate(ctx) {
    const scope = createScope();
    ctx.effect(() => scope.dispose);
    const session = ctx.use("conversationSession"), place = ctx.use("placeContext");
    const viewport = mountMainViewport(scope, {
      main: session.main, view: ctx.use("currentView"), takeFoldChange: session.folds.takeChange,
      heraldRoom: ctx.use("noticeLine").heraldRoom, CH: ctx.use("chats"), world: ctx.use("world"),
      convThread: place.convThread, chatOf: place.convProject, render: () => ctx.emit("app:render"),
    });
    ctx.on("app:view-visited", viewport.follow);
    ctx.on("app:return-target", viewport.returnPill);
    ctx.provide("mainViewport", viewport);
  },
};
