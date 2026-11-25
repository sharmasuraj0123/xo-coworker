// @ts-check

import { canPageOlder } from "../../core/services/world/rows.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import { PagingDeps, Conversation } from "./paging-types.d.ts" */

/** @param {PagingDeps} options @param {AbortSignal} [signal] */
export function createConversationPaging({ MAIN, CH, world, convThread, chatOf, render }, signal) {
  /** @param {unknown} error */
  const failed = (error) => { if (!signal?.aborted) reportFailure(error); };
  /** @param {Conversation} [C] */
  function loadAhead(C = MAIN) {
    const v = C.view;
    if (C.rendered !== v || v === "home" || CH.isChats(v)) return;
    if (C.follow.fromTop() > Math.max(600, C.scroller.clientHeight)) return;
    const t = convThread(v);
    if (t) {
      if (canPageOlder(world.state.threadHist?.[t.id])) world.act.loadOlderThread?.(t.id).catch(failed);
      return;
    }
    const c = chatOf(v); const h = c && world.state.hist[c];
    if (h && h.loaded && !h.all && !h.loading && !h.olderError) world.act.loadOlder(c).catch(failed);
  }

  /** @param {Conversation} [C] */
  function loadOlderNow(C = MAIN) {
    const from = document.activeElement?.closest?.("[data-older]") ? C.view : null;
    if (from) C.scroller.focus({ preventScroll: true });
    let read = null;
    const t = convThread(C.view);
    if (t) { const th = world.state.threadHist?.[t.id]; if (th && th.olderError) th.olderError = null; if (world.act.loadOlderThread) read = world.act.loadOlderThread(t.id); }
    else { const c = chatOf(C.view); if (c) read = world.act.loadOlder(c); }
    const restore = () => {
      if (!from || signal?.aborted || !C.scroller.isConnected || C.view !== from || document.activeElement !== C.scroller) return;
      render();
      (/** @type {HTMLElement | null} */ (C.msgs.querySelector("[data-older]")))?.focus({ preventScroll: true });
    };
    void Promise.resolve(read).then(restore, (error) => { failed(error); restore(); }).catch(failed);
  }

  return { loadAhead, loadOlderNow };
}
