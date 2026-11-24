// @ts-check

import { createScope } from "../core/kernel/scope.js";

/** @param {Pick<ReturnType<typeof createScope>, "listen">} scope */
export function createOverlayFocus(scope) {
  /** @param {HTMLElement} target */
  return function focusOverlay(target) {
    target.focus({ preventScroll: true });
    const modal = [...document.querySelectorAll("dialog[open]")].find((d) => d.matches(":modal"));
    if (modal) {
      const unlisten = scope.listen(modal, "close", () => {
        unlisten();
        if (target.isConnected && !target.closest("[hidden]")) target.focus({ preventScroll: true });
      });
    }
  };
}

/** @param {{layers: ReturnType<typeof import("./layers.js").stackLayers>, phone: MediaQueryList, app: HTMLElement, main: HTMLElement, side: HTMLElement, settings: HTMLElement}} deps */
export function mountKeyboardLayers({ layers, phone, app, main, side, settings }) {
  const scope = createScope();
  /** @type {Set<HTMLElement>} */
  const held = new Set();
  /** @param {HTMLElement} el */
  const release = (el) => { if (held.delete(el)) el.inert = false; };
  scope.effect(() => () => held.forEach(release));

  function syncInert() {
    if (scope.signal.aborted) return;
    /** @param {HTMLElement} el @param {boolean} on */
    const hold = (el, on) => {
      if (!on) release(el);
      else if (!el.inert) { el.inert = true; held.add(el); }
    };
    hold(app, layers.inertsApp());
    const settingsOpen = layers.isOpen("settings");
    for (const el of held) if (el !== app && el !== main && el !== side && el.parentElement !== main) release(el);
    for (const el of /** @type {HTMLCollectionOf<HTMLElement>} */ (main.children)) if (el !== settings && !el.classList.contains("toast-wrap")) hold(el, settingsOpen);
    const drawer = layers.isOpen("drawer");
    hold(side, phone.matches && !drawer);
    hold(main, phone.matches && drawer);
  }
  queueMicrotask(() => {
    if (scope.signal.aborted) return;
    scope.listen(phone, "change", syncInert);
    const observer = new MutationObserver(syncInert);
    scope.observe(observer);
    for (const el of layers.watched) observer.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    syncInert();
  });
  scope.listen(window, "keydown", (e) => {
    if (!("key" in e) || e.key !== "Tab" || e.defaultPrevented) return;
    const top = layers.keyLayer();
    if (!top) return;
    const f = [.../** @type {NodeListOf<HTMLElement & {disabled?: boolean}>} */ (top.querySelectorAll("*"))].filter((x) => x.tabIndex >= 0 && !x.disabled && !x.closest("[inert]") && x.getClientRects().length > 0);
    if (!f.length) return;
    const a = document.activeElement, inside = a && top.contains(a);
    const after = inside && f.some((x) => x !== a && a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
    const before = inside && f.some((x) => x !== a && x.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
    const backwards = "shiftKey" in e && e.shiftKey === true;
    if (backwards ? !before : !after) { e.preventDefault(); (backwards ? f[f.length - 1] : f[0]).focus(); }
  });
  return { syncInert, dispose: scope.dispose };
}
