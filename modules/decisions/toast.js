// @ts-check

import { esc } from "../../core/platform/util.js";
import { xi } from "../../core/ui/icons/icon.js";
import { ICON } from "../../core/ui/icons/names.js";
import { $ } from "../../core/platform/dom.js";

/** @typedef {Pick<import("./queue-types.d.ts").DecisionQueueItem, "id" | "due" | "meta">} Entry */

/** @param {{queued: Entry[], undo(id: number): unknown, timeout: import("../../core/kernel/types.d.ts").ModuleContext["timeout"]}} queue */
export function createDecisionToast(queue) {
  const toast = /** @type {HTMLElement} */ ($("#toast"));
  /** @type {Entry | null} */
  let toastItem = null;
  function toastRender() {
    const it = [...queue.queued].reverse().find((x) => !x.meta.inline);
    if (!it) {
      if (toastItem) {
        toast.classList.add("bye");
        queue.timeout(() => { if (!queue.queued.length) { toast.hidden = true; toast.classList.remove("bye"); } }, 200);
      }
      toastItem = null;
      return;
    }
    if (toastItem === it) return;
    toastItem = it;
    const deny = !!it.meta.deny;
    const left = Math.max(0, it.due - Date.now());
    toast.className = `hr hr-ev has-undo is-in k-${deny ? "calm" : "done"}`;
    toast.hidden = false;
    toast.innerHTML = `<span class="hr-ic ${deny ? "k-calm" : "k-ok"}">${deny ? ICON.rewind : ICON.check}</span><span class="hr-t">${esc(it.meta.verb)}: ${esc(it.meta.label)}</span>` +
      `<button type="button" class="hr-undo" title="Undo">${xi("undo-countdown", "t-ring").replace("<path ", `<path pathLength="1" style="animation-duration:${left}ms" `)}Undo</button>`;
    (/** @type {HTMLButtonElement} */ (toast.querySelector(".hr-undo"))).addEventListener("click", () => queue.undo(it.id));
  }

  return toastRender;
}
