// @ts-check
import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import {ThreadDeletePrompt} from "./delete-types" */

/** @param {() => ThreadDeletePrompt | null} prompt */
export function createThreadDeleteView(prompt) {
  /** @param {{id: string, title: string, branch?: string | null, git?: {ahead?: number}} | null | undefined} thread */
  return function renderDelete(thread) {
    const box = document.getElementById("tdel");
    if (!box) return;
    const current = prompt();
    if (!thread || current?.id !== thread.id) {
      box.hidden = true;
      redraw(box, "");
      return;
    }
    const loss = current.loss;
    const ahead = thread.git?.ahead;
    const branchDetail = ahead ? `, ${ahead} commit${ahead === 1 ? "" : "s"} ahead of where it started` : "";
    const branch = thread.branch
      ? `<div class="wt-loss"><p>Its branch <code>${esc(thread.branch)}</code> is kept${branchDetail}.</p></div>` : "";
    const work = loss ? `<div class="wt-loss"><p><b>${esc(loss.summary || "Work that isn't kept anywhere else")}</b></p></div>` : "";
    const label = loss ? "Delete anyway" : "Delete thread";
    box.hidden = false;
    redraw(box, '<div class="wt-confirm" role="alertdialog" aria-labelledby="tdel-q">'
      + `<p class="wt-q" id="tdel-q"><b>Delete “${esc(thread.title)}”?</b> Its messages and transcript go, `
      + "and its worktree folder is removed. You can undo it for a few seconds.</p>"
      + branch + work + '<div class="set-fa" data-key="actions"><button type="button" class="btn" data-tdel-no>Keep it</button>'
      + `<button type="button" class="btn btn-danger" data-key="${esc(thread.id)}" data-tdel-yes="${esc(thread.id)}"`
      + `${busyAttrs(`tdel:${thread.id}`)}>${label}</button></div></div>`);
  };
}
