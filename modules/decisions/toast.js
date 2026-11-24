// @ts-check

import { esc } from "../../core/platform/util.js";
import { xi } from "../../core/ui/icons/icon.js";
import { ICON } from "../../core/ui/icons/names.js";
import { $ } from "../../core/platform/dom.js";

/** @typedef {{id: number, due: number, meta: {inline?: boolean, deny?: boolean, verb: string, label: string}}} Entry */

/** @param {{queued: Entry[], undo(id: number): unknown}} queue */
export function createDecisionToast(queue) {
  const toast = /** @type {HTMLElement} */ ($("#toast"));
  /** @type {Entry | null} */
  let toastItem = null;
  function toastRender() {
    const it = [...queue.queued].reverse().find((x) => !x.meta.inline);
    if (!it) {
      if (toastItem) { toast.classList.add("bye"); setTimeout(() => { if (!queue.queued.length) { toast.hidden = true; toast.classList.remove("bye"); } }, 200); }
      toastItem = null;
      return;
    }
    if (toastItem === it) return;
    toastItem = it;
    const deny = !!it.meta.deny;
    const left = Math.max(0, it.due - Date.now());
    toast.className = `toast t-${deny ? "back" : "allow"}`;
    toast.hidden = false;
    toast.innerHTML = `<span class="t-ic">${deny ? ICON.rewind : ICON.check}</span><span class="t-m"><b>${esc(it.meta.verb)}</b> <span>${esc(it.meta.label)}</span></span>` +
      `<button type="button" class="t-undo" title="Undo">${xi("undo-countdown", "t-ring").replace("<path ", `<path pathLength="1" style="animation-duration:${left}ms" `)}Undo</button>`;
    (/** @type {HTMLButtonElement} */ (toast.querySelector(".t-undo"))).addEventListener("click", () => queue.undo(it.id));
  }

  return toastRender;
}
