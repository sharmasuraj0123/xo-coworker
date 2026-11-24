// @ts-check

/** @import { Conversation } from "./draw-types.d.ts" */

/** @param {{ S: { view: string, scroll: Record<string, number>, alias: Map<string, string> }, pageEl(view: string): HTMLElement | null, main(): Conversation }} options */
export function createConversationNavigation({ S, pageEl, main }) {
  function saveScroll() {
    if (pageEl(S.view)) S.scroll[S.view] = (/** @type {HTMLElement} */ (pageEl(S.view))).scrollTop;
  }

  /** @param {string} id @param {Conversation} [C] */
  function showMsg(id, C = main()) {
    let tries = 0;
    const look = () => {
      const el = C.msgs.querySelector(`[data-k="${CSS.escape(S.alias.get(id) || id)}"]`);
      if (!el) { if (++tries < 20) setTimeout(look, 100); return; }
      C.follow.toRow(/** @type {HTMLElement} */ (el), true);
      el.classList.remove("is-flash"); void (/** @type {HTMLElement} */ (el)).offsetWidth; el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1800);
    };
    setTimeout(look, 120);
  }

  return { saveScroll, showMsg };
}
