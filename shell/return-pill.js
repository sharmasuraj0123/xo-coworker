// @ts-check
import { findHtml, requireHtml } from "../core/platform/dom.js";
import { space } from "../core/platform/util.js";
import { ICON } from "../core/ui/icons/names.js";

/** @typedef {Pick<import("../core/kernel/types").ModuleContext, "effect" | "frame" | "listen" | "timeout">} Scope */

/** @typedef {{ msgsEl: HTMLElement, scroller: HTMLElement, toRow(el: HTMLElement, smooth: boolean): void }} ReturnOptions */

/** @param {Scope} scope @param {ReturnOptions} options */
export function createReturnPill(scope, { msgsEl, scroller, toRow }) {
  /** @type {HTMLButtonElement | null} */
  let pill = null;
  /** @type {string | null} */
  let key = null;
  let cancelFrame = () => {};
  const currentRow = () => key ? findHtml(`:scope > [data-k="${CSS.escape(key)}"]`, undefined, msgsEl) : null;
  /** @param {HTMLElement} row */
  const inSight = (row) => {
    const a = row.getBoundingClientRect(), b = scroller.getBoundingClientRect();
    return a.bottom > b.top + 40 && a.top < b.bottom - 120;
  };
  function mount() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "mx-return";
    button.className = "mx-return";
    button.innerHTML = `${ICON.arrow}<span>Back to where you were</span>`;
    requireHtml("#conv").append(button);
    scope.effect(() => () => button.remove());
    scope.listen(button, "click", () => {
      button.hidden = true;
      const row = currentRow();
      if (!row) return;
      toRow(row, true);
      const back = findHtml("[data-go]", undefined, row)
        || [...row.querySelectorAll("button, a[href]")].find(el => el instanceof HTMLElement && el.offsetParent);
      if (back instanceof HTMLElement) back.focus({ preventScroll: true });
      row.classList.remove("is-flash");
      void row.offsetWidth;
      row.classList.add("is-flash");
      scope.timeout(() => row.classList.remove("is-flash"), 1800);
    });
    scope.listen(scroller, "scroll", () => {
      if (button.hidden) return;
      const row = currentRow();
      if (!row || inSight(row)) button.hidden = true;
    }, { passive: true });
    return button;
  }
  /** @param {Element | null} target */
  return function returnPill(target) {
    cancelFrame();
    key = target?.closest("#msgs > [data-k]")?.getAttribute("data-k") ?? null;
    if (!key) { if (pill) pill.hidden = true; return; }
    cancelFrame = scope.frame(() => {
      const row = currentRow();
      if (!row || inSight(row)) { if (pill) pill.hidden = true; return; }
      pill ??= mount();
      pill.style.top = `${scroller.offsetTop + space("--s-3")}px`;
      pill.hidden = false;
    });
  };
}
