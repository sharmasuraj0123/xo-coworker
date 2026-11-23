// @ts-check
import { esc } from "../../core/platform/util.js";

/** @typedef {import("./groups-types.d.ts").ThreadInfo & { label?: string, canDelete?: boolean }} MenuThread */
/** @typedef {{ panelThreads: ReturnType<typeof import("./groups.js").createThreadGroups>["panelThreads"], SH: { enabled: boolean }, movable: (t: MenuThread) => boolean, isBusy: (t: MenuThread) => boolean }} MenuDeps */

/** @param {MenuDeps} options */
export function createThreadMenu({ panelThreads, SH, movable, isBusy }) {
  /** @param {MenuThread} t */
  function threadSiblings(t) {
    const list = panelThreads("t:" + t.id).flatMap((g) => g.rows).filter((r) => !r.coord).map((r) => r.go);
    const i = list.indexOf("t:" + t.id);
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  }
  /** @param {MenuThread} t */
  function threadMenuHtml(t, where = "main") {
    const sib = threadSiblings(t), item = /** @param {string} attrs @param {string} words */ (attrs, words, off = false) => `<button type="button" role="menuitem" ${attrs}${off ? ' aria-disabled="true"' : ""}>${words}</button>`;
    const sep = '<span class="tw-sep" role="separator"></span>';
    const groups = [
      [item(`data-tgo="${esc(sib.prev || "")}"`, "Previous thread", !sib.prev), item(`data-tgo="${esc(sib.next || "")}"`, "Next thread", !sib.next),
        where === "page" ? item(`data-tp-main="${esc(t.id)}"`, "Open in main chat") : item(`data-tside="${esc(t.id)}"`, "Open beside its project's chat")],
      [SH.enabled ? item(`data-shell="t:${esc(t.id)}"`, "Open a shell in its worktree") : "",
        t.branch ? item(`data-tcopy="${esc(t.branch)}"`, "Copy branch name") : ""],
      [item('data-tfield="title"', "Rename"), item('data-tfield="label"', t.label ? "Change label" : "Add a label"), t.label ? item('data-tfield="clear-label"', "Remove the label") : "",
        movable(t) ? item(`data-tmove="${esc(t.id)}"`, "Continue on another runtime…") : "",
        isBusy(t) ? item("data-chat-stop", "Stop") : ""],
      [t.canDelete ? item(`data-tdel="${esc(t.id)}" class="tw-danger"`, "Delete thread…") : ""],
    ].map((g) => g.filter(Boolean).join("")).filter(Boolean);
    return `<span class="tw-menu" role="menu" tabindex="-1">${groups.join(sep)}</span>`;
  }
  return threadMenuHtml;
}
