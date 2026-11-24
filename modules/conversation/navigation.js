// @ts-check

/** @import { Conversation } from "./draw-types.d.ts" */

/** @param {{ alias(id: string): string | undefined, main(): Conversation }} options */
export function createConversationNavigation({ alias, main }) {
  /** @param {string} id @param {Conversation} [C] */
  function showMsg(id, C = main()) {
    let tries = 0;
    const look = () => {
      const el = C.msgs.querySelector(`[data-k="${CSS.escape(alias(id) || id)}"]`);
      if (!el) { if (++tries < 20) setTimeout(look, 100); return; }
      C.follow.toRow(/** @type {HTMLElement} */ (el), true);
      el.classList.remove("is-flash"); void (/** @type {HTMLElement} */ (el)).offsetWidth; el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1800);
    };
    setTimeout(look, 120);
  }

  return { showMsg };
}
