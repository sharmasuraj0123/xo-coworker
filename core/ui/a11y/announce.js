// @ts-check

/** @param {HTMLElement} live @param {Pick<import("../../kernel/types").ModuleContext, "signal" | "timeout">} scope */
export function createAnnouncer(live, scope) {
  /** @param {string} text @param {(() => boolean) | null} still */
  function announce(text, still = null) {
    if (scope.signal.aborted) return;
    live.textContent = "";
    scope.timeout(() => { if (!still || still()) live.textContent = text; }, 40);
  }
  return announce;
}
