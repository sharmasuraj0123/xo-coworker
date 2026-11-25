// @ts-check
import { $ } from "../../core/platform/dom.js";
/** @typedef {{ dock: HTMLElement, host: HTMLElement, heraldRoom(): void }} DockLayout */

/** @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope @param {DockLayout} layout */
export function watchDock(scope, { dock, host, heraldRoom }) {
  const bar = dock.querySelector(".cbar");
  const ro = new ResizeObserver(() => {
    host.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
    if (!bar) return;
    const on = bar.getBoundingClientRect().top - dock.getBoundingClientRect().top > 0.5;
    if (dock.classList.contains("is-stacked") !== on) dock.classList.toggle("is-stacked", on);
    heraldRoom();
  });
  scope.observe(ro);
  ro.observe(dock);
}
/** Chats leads with the composer and other conversations put it after the messages. @param {boolean} top */
export function dockAtTop(top) {
  const dock = $("#dock"), sc = $("#scroller");
  if (top === (dock.parentElement === sc)) return;
  const active = document.activeElement;
  const had = active instanceof HTMLElement && dock.contains(active) ? active : null;
  if (top) $("#cs-sub").after(dock); else $("#drop-veil").after(dock);
  $("#cs-hi").hidden = $("#cs-sub").hidden = !top;
  if (!top) sc.style.removeProperty("--cs-lead");
  dock.classList.toggle("is-top", top);
  had?.focus({ preventScroll: true });
}
