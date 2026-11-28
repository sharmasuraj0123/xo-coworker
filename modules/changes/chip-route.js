// @ts-check

/** @import { ChipRoute } from "./chip-route-types.d.ts" */

/** @param {ChipRoute} deps */
export function createChangeChipRoute({ changes, conversationAt, showChange, openFile, focusAfterDraw, schedule }) {
  /** @param {Element} target @param {Pick<MouseEvent, "metaKey" | "ctrlKey">} event */
  return function route(target, event) {
    const chip = target.closest(".tb-cf[data-file]");
    if (!chip) return false;
    const conversation = conversationAt(chip);
    const change = changes.forTarget(conversation.view, chip.getAttribute("data-file") || "");
    if (!change) return false;
    const { path } = change;
    conversation.follow.unpin(chip);
    const scope = changes.scope(conversation.view);
    function openInFiles() {
      if (!scope || !(chip instanceof HTMLElement)) return;
      const rel = scope.worktree ? `.xo/worktrees/${scope.worktree}/${path}` : path;
      openFile({ path, name: path.split("/").pop(), project: scope.project, rel, show: "changes" }, chip);
    }
    if (scope && (event.metaKey || event.ctrlKey)) { openInFiles(); return true; }
    if (showChange(path)) {
      focusAfterDraw([`#stage [data-cx="${CSS.escape(path)}"]`, "#stage .cx-pd"]);
      schedule();
      return true;
    }
    if (scope) { openInFiles(); return true; }
    return false;
  };
}
