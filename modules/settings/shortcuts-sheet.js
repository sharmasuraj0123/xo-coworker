// @ts-check

/** @param {{keys: HTMLElement, closeButton: HTMLElement, keysSheetRender: () => void, focusOverlay: (target: HTMLElement) => void, syncInert: () => void}} deps */
export function createShortcutsSheet({ keys, closeButton, keysSheetRender, focusOverlay, syncInert }) {
  keys.addEventListener("click", (e) => { if (e.target === keys || /** @type {Element} */ (e.target).closest("[data-close]")) closeKeys(); });
  /** @type {HTMLElement | null} */
  let keysReturn = null;
  function openKeys() { keysSheetRender(); keysReturn = /** @type {HTMLElement | null} */ (document.activeElement); keys.hidden = false; focusOverlay(closeButton); }
  function closeKeys() { keys.hidden = true; syncInert(); keysReturn?.focus?.({ preventScroll: true }); }
  return { openKeys, closeKeys };
}
