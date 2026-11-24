// @ts-check
import { $ } from "../core/platform/dom.js";
import { space } from "../core/platform/util.js";
import { ICON } from "../core/ui/icons/names.js";

/** @typedef {{ _find: () => HTMLElement | null; _seen: (element: HTMLElement) => boolean }} ReturnTarget */

/** @typedef {HTMLButtonElement & Partial<ReturnTarget>} ReturnButton */

/** @typedef {HTMLButtonElement & ReturnTarget} ClickedReturnButton */

/** @param {{ msgsEl: HTMLElement; scroller: HTMLElement; toRow: (element: HTMLElement, smooth: boolean) => void }} options */
export function createReturnPill({ msgsEl, scroller, toRow }) {
  /** @param {Element | null} target */
  return function returnPill(target) {
    /** @type {ReturnButton | null} */
    let pill = $("#mx-return");
    // the message is held by its key, never its node: a redraw replaces nodes, and the key finds the one now drawn
    const row = target && target.closest ? (/** @type {HTMLElement | null} */ (target.closest("#msgs > [data-k]"))) : null;
    const key = row ? row.dataset.k : null;
    if (!key) { if (pill) pill.hidden = true; return; }
    /** @type {() => HTMLElement | null} */
    const find = () => msgsEl.querySelector(`:scope > [data-k="${CSS.escape(key)}"]`);
    /** @param {HTMLElement} el */
    const inSight = (el) => { const a = el.getBoundingClientRect(), b = scroller.getBoundingClientRect(); return a.bottom > b.top + 40 && a.top < b.bottom - 120; };
    requestAnimationFrame(() => {
      const el = find();
      if (!el || inSight(el)) { if (pill) pill.hidden = true; return; }
      if (!pill) {
        pill = document.createElement("button");
        pill.type = "button"; pill.id = "mx-return"; pill.className = "mx-return";
        $("#conv").append(pill);
        pill.addEventListener("click", () => {
          (/** @type {ReturnButton} */ (pill)).hidden = true;
          const el = (/** @type {ClickedReturnButton} */ (pill))._find && (/** @type {ClickedReturnButton} */ (pill))._find();
          if (!el) return; // it isn't drawn any more: nothing to go back to
          toRow(el, true);
          // the control you left from (the card or link that opened the thread), else the first one in the message
          const back = /** @type {HTMLElement | null} */ (el.querySelector("[data-go]")) || [.../** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("button, a[href]"))].find((b) => b.offsetParent);
          back?.focus({ preventScroll: true });
          el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash"); setTimeout(() => el.classList.remove("is-flash"), 1800);
        });
        scroller.addEventListener("scroll", () => {
          if ((/** @type {ReturnButton} */ (pill)).hidden || !(/** @type {ReturnButton} */ (pill))._find) return;
          const el = (/** @type {ClickedReturnButton} */ (pill))._find();
          if (!el || (/** @type {ClickedReturnButton} */ (pill))._seen(el)) (/** @type {ReturnButton} */ (pill)).hidden = true; // gone, or you've reached it
        }, { passive: true });
      }
      pill._find = find; pill._seen = inSight;
      pill.style.top = `${scroller.offsetTop + space("--s-3")}px`; // --s-3 under the header, whatever its height
      pill.innerHTML = `${ICON.arrow}<span>Back to where you were</span>`;
      pill.hidden = false;
    });
  };
}
