// @ts-check

/** @import { Conversation } from "./draw-types.d.ts" */

/** @typedef {{ alias(id: string): string | undefined, main(): Conversation }} MessageNavigation */

/** @param {Pick<import("./composer-types").ComposerScope, "timeout">} scope @param {MessageNavigation} options */
export function createConversationNavigation(scope, { alias, main }) {
  /** @param {string} id @param {Conversation} [C] */
  function showMsg(id, C = main()) {
    let tries = 0;
    const look = () => {
      const el = C.msgs.querySelector(`[data-k="${CSS.escape(alias(id) || id)}"]`);
      if (!el) { if (++tries < 20) scope.timeout(look, 100); return; }
      C.follow.toRow(/** @type {HTMLElement} */ (el), true);
      el.classList.remove("is-flash"); void (/** @type {HTMLElement} */ (el)).offsetWidth; el.classList.add("is-flash");
      scope.timeout(() => el.classList.remove("is-flash"), 1800);
    };
    scope.timeout(look, 120);
  }

  return { showMsg };
}
