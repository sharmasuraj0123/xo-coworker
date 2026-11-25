// @ts-check
import { $ } from "../../core/platform/dom.js";
import { mountMainDecoration } from "./main-decoration.js";
import { watchDock } from "./dock-layout.js";
import { initFollow, toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } from "./follow.js";
import { createReturnPill } from "../../shell/return-pill.js";
import { pageEl } from "../../shell/place-context.js";
import { createLiveConversation } from "./live.js";
import { createConversationNavigation } from "./navigation.js";
import { createConv } from "./draw.js";
import { createReadingLayout } from "./reading-layout.js";
import { createConversationPaging } from "./paging.js";

/** @import { ViewportOptions, ViewportScope } from "./main-viewport-types.d.ts" */

/** @param {ViewportScope} scope @param {ViewportOptions} options */
export function mountMainViewport(scope, { view, takeFoldChange, heraldRoom, alias, ...paging }) {
  const scroller = $("#scroller"), msgsEl = $("#msgs");
  const MAIN = createConv({
    view, msgs: msgsEl, scroller, column: $("#column"), typing: $("#typing"), main: true,
    follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest },
  });
  const reading = createReadingLayout({ takeFoldChange, MAIN });
  const { loadAhead, loadOlderNow } = createConversationPaging({ ...paging, MAIN }, scope.signal);
  let scrolling = false;
  scope.listen(scroller, "scroll", () => {
    if (scrolling) return;
    scrolling = true;
    scope.frame(() => {
      scrolling = false;
      loadAhead();
      $("#top").classList.toggle("is-scrolled", fromTop() > 120);
    });
  }, { passive: true });
  watchDock(scope, { dock: $("#dock"), host: $("#app"), heraldRoom });
  scope.effect(initFollow);
  scope.effect(mountMainDecoration);
  const returnPill = createReturnPill({ msgsEl, scroller, toRow });
  const { showMsg } = createConversationNavigation(scope, { alias, main: () => MAIN });
  const live = createLiveConversation({ ...paging, view });
  return { ...live, returnPill, showMsg, placeRegion: () => pageEl(view()) || scroller,
    MAIN, scroller, msgsEl, reading, loadAhead, loadOlderNow };
}
