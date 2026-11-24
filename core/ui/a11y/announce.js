// @ts-check

/** @param {HTMLElement} live @param {{signal?: AbortSignal, timeout: (run: () => void, ms: number) => unknown}} scope */
export function createAnnouncer(live, scope = { timeout: (run, delay) => setTimeout(run, delay) }) {
  /** @param {string} text @param {(() => boolean) | null} still */
  function announce(text, still = null) {
    if (scope.signal?.aborted) return;
    live.textContent = "";
    scope.timeout(() => { if (!still || still()) live.textContent = text; }, 40);
  }
  return announce;
}
