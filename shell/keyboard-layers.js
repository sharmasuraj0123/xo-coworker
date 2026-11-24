// @ts-check

/** @param {HTMLElement} target */
export function focusOverlay(target) {
  target.focus({ preventScroll: true });
  const modal = [...document.querySelectorAll("dialog[open]")].find((d) => d.matches(":modal"));
  if (modal) modal.addEventListener("close", () => { if (target.isConnected && !target.closest("[hidden]")) target.focus({ preventScroll: true }); }, { once: true });
}

/** @param {{layers: ReturnType<typeof import("./layers.js").stackLayers>, phone: MediaQueryList, app: HTMLElement, main: HTMLElement, side: HTMLElement, settings: HTMLElement}} deps */
export function mountKeyboardLayers({ layers, phone, app, main, side, settings }) {
  function syncInert() {
    /** @param {HTMLElement} el @param {boolean} on */
    const hold = (el, on) => { if (on && !el.inert) { el.inert = true; el.dataset.layerInert = ""; } else if (!on && "layerInert" in el.dataset) { el.inert = false; delete el.dataset.layerInert; } };
    hold(app, layers.inertsApp());
    const settingsOpen = layers.isOpen("settings");
    for (const el of /** @type {HTMLCollectionOf<HTMLElement>} */ (main.children)) if (el !== settings && !el.classList.contains("toast-wrap")) hold(el, settingsOpen);
    const drawer = layers.isOpen("drawer");
    hold(side, phone.matches && !drawer);
    hold(main, phone.matches && drawer);
  }
  queueMicrotask(() => {
    phone.addEventListener("change", syncInert);
    const observer = new MutationObserver(syncInert);
    for (const el of layers.watched) observer.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    syncInert();
  });
  addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.defaultPrevented) return;
    const top = layers.keyLayer();
    if (!top) return;
    const f = [.../** @type {NodeListOf<HTMLElement & {disabled?: boolean}>} */ (top.querySelectorAll("*"))].filter((x) => x.tabIndex >= 0 && !x.disabled && !x.closest("[inert]") && x.getClientRects().length > 0);
    if (!f.length) return;
    const a = document.activeElement, inside = a && top.contains(a);
    const after = inside && f.some((x) => x !== a && a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
    const before = inside && f.some((x) => x !== a && x.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (e.shiftKey ? !before : !after) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
  });
  return syncInert;
}
