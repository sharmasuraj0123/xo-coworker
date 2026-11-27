// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { usable } from "../../core/ui/a11y/focus.js";

const SEEK_MS = 10000;

/** @param {HTMLElement} el @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope */
function rowSeeker(el, scope) {
  let stop = () => {};
  /** @param {string} key */
  function seek(key) {
    stop();
    const land = () => {
      const row = el.querySelector(`[data-page]:not([hidden]) [data-key="${CSS.escape(key)}"]`);
      const to = row?.querySelector(".btn-pri") || row?.querySelector("button, a[href]");
      if (!(to instanceof HTMLElement) || el.hidden) return false;
      stop();
      to.focus();
      return true;
    };
    if (land()) return;
    const watch = new MutationObserver(land);
    scope.observe(watch);
    watch.observe(el, { childList: true, subtree: true });
    const stopTimer = scope.timeout(() => stop(), SEEK_MS);
    stop = () => { stop = () => {}; watch.disconnect(); stopTimer(); };
  }
  return { seek, stop: () => stop() };
}

/** @param {import("./types").SettingsFrameDeps} deps */
export function createSettingsFrame({
  el, side, phoneButton, closeButton, onPage, beforeOpen, beforeClose, onHidden, focusIn, fallback, phone, onOpen, scope = createScope(),
}) {
  /** @type {Element | null} */
  let setReturn = null;
  /** @param {string} selector */
  const all = (selector) => [...el.querySelectorAll(selector)].filter((node) => node instanceof HTMLElement);

  /** @param {string} id */
  function setPage(id) {
    if (scope.signal.aborted) return;
    for (const b of all("[data-set]")) {
      const on = b.dataset.set === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const p of all("[data-page]")) p.hidden = p.dataset.page !== id;
    onPage(id);
  }
  function open() {
    if (scope.signal.aborted || !el.hidden) return;
    beforeOpen();
    setReturn = document.activeElement;
    el.hidden = false;
    side.classList.add("is-on");
    side.setAttribute("aria-expanded", "true");
    const first = /** @type {HTMLElement | null} */ (el.querySelector('[aria-selected="true"]'));
    if (first) focusIn(first);
    onOpen?.(first?.dataset.set);
  }
  function close({ restore = true } = {}) {
    if (el.hidden) return;
    rows.stop();
    beforeClose();
    el.hidden = true;
    onHidden();
    side.classList.remove("is-on");
    side.setAttribute("aria-expanded", "false");
    const opener = setReturn;
    setReturn = null;
    if (restore) {
      const target = [opener, fallback()].find((x) => x instanceof HTMLElement && usable(x) && !("disabled" in x && x.disabled));
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }
  }
  scope.listen(side, "click", () => (el.hidden ? open() : close()));
  scope.listen(phoneButton, "click", open);
  scope.listen(closeButton, "click", () => close());
  const rows = rowSeeker(el, scope);
  scope.listen(document, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    const from = target.closest("[data-set-open]"), id = from?.getAttribute("data-set-open");
    if (id == null) return;
    rows.stop();
    setPage(id);
    if (el.hidden) open();
    else {
      const selected = el.querySelector('[aria-selected="true"]');
      if (selected instanceof HTMLElement) selected.focus({ preventScroll: true });
    }
    const row = from?.getAttribute("data-set-row");
    if (row) rows.seek(row);
  });
  const nav = /** @type {HTMLElement} */ (el.querySelector(".set-nav"));
  scope.listen(nav, "click", ({ target }) => {
    const id = target instanceof Element ? target.closest("[data-set]")?.getAttribute("data-set") : null;
    if (id != null) setPage(id);
  });
  scope.listen(nav, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tabs = all("[data-set]");
    const i = tabs.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (i < 0) return;
    const j = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
      : e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : -1;
    if (j < 0) return;
    e.preventDefault();
    tabs[j].focus(); setPage(/** @type {string} */ (tabs[j].dataset.set));
  });
  const orient = () => nav.setAttribute("aria-orientation", phone.matches ? "horizontal" : "vertical");
  orient();
  scope.listen(phone, "change", orient);
  scope.effect(() => () => close({ restore: el.contains(document.activeElement) }));
  return { setPage, open, close, dispose: scope.dispose };
}
