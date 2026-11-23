// @ts-check
import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { $ } from "../../core/platform/dom.js";
import { redraw } from "../../core/ui/redraw.js";

/** @param {{ tDel?: string | null, tDelLose?: { summary?: string | null } | null }} S */
export function createThreadDeleteView(S) {
  /** @param {{ id: string, title: string, branch?: string, git?: { ahead?: number } } | null | undefined} t */
  function tdelRender(t) {
    const box = /** @type {HTMLElement & { _h?: string }} */ ($("#tdel"));
    const on = !!(t && S.tDel === t.id);
    box.hidden = !on;
    if (!on) { if (box._h) { box.innerHTML = ""; box._h = ""; } return; }
    const lose = S.tDelLose;
    const html = `<div class="wt-confirm" role="alertdialog" aria-labelledby="tdel-q"><p class="wt-q" id="tdel-q"><b>Delete “${esc(t.title)}”?</b> Its messages and transcript go, and its worktree folder is removed. You can undo it for a few seconds.</p>` +
      (t.branch ? `<div class="wt-loss"><p>Its branch <code>${esc(t.branch)}</code> is kept${t.git && t.git.ahead ? `, ${t.git.ahead} commit${t.git.ahead === 1 ? "" : "s"} ahead of where it started` : ""}.</p></div>` : "") +
      (lose ? `<div class="wt-loss"><p><b>${esc(lose.summary || "Work that isn't kept anywhere else")}</b></p></div>` : "") +
      `<div class="set-fa"><button type="button" class="btn" data-tdel-no>Keep it</button><button type="button" class="btn btn-danger" data-tdel-yes="${esc(t.id)}"${busyAttrs(`tdel:${t.id}`)}>${lose ? "Delete anyway" : "Delete thread"}</button></div></div>`;
    if (box._h !== html) { redraw(box, html); box._h = html; }
  }
  return tdelRender;
}
