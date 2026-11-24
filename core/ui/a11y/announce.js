// @ts-check

/** @param {HTMLElement} live */
export function createAnnouncer(live) {
  /** @param {string} text @param {(() => boolean) | null} still */
  function announce(text, still = null) { live.textContent = ""; setTimeout(() => { if (!still || still()) live.textContent = text; }, 40); }
  return announce;
}
