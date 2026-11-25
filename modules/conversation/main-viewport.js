// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { mountMainDecoration } from "./main-decoration.js";
import { watchDock } from "./dock-layout.js";
import { initFollow, fromTop, toRow } from "./follow.js";
import { createReturnPill } from "../../shell/return-pill.js";
import { createLiveConversation } from "./live.js";
import { createReadingLayout } from "./reading-layout.js";
import { createConversationPaging } from "./paging.js";

/** @import { ViewportOptions, ViewportScope } from "./main-viewport-types.d.ts" */

/** @param {ViewportScope} scope @param {ViewportOptions} options */
export function mountMainViewport(scope, { view, main: MAIN, takeFoldChange, heraldRoom, ...paging }) {
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
