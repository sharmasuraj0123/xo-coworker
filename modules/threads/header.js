// @ts-check
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";

/** @param {number} n @param {{ working: number, needs: number }} by */
export function threadsCtl(n, by) {
  if (!n) return "";
  const words = [`${n} ${n === 1 ? "thread" : "threads"}`, by.working && `${by.working} working`, by.needs && `${by.needs} ${by.needs === 1 ? "needs" : "need"} you`].filter(Boolean).join(", ");
  const live = (by.working ? `<span class="th-seg is-work">${stateMark("working")}<span class="pj-k">${by.working}</span></span>` : "") +
    (by.needs ? `<span class="th-seg is-need">${stateMark("needs_reply")}<span class="pj-k">${by.needs}</span></span>` : "");
  return `<button type="button" class="tw-act th-ctl" data-stage-open aria-controls="stage" title="${esc(words)}: open them in the panel" aria-label="${esc(words)}. Open them in the panel">` +
    `${ICON.threadOne}<span class="th-w">Threads</span><span class="th-n">${n}</span>${live}</button>`;
}
