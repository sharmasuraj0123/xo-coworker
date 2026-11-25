// @ts-check
import { createFileRoute } from "../../core/services/file-route.js";

/** @import { ConversationFilesDeps } from "./conversation-files-types" */

/** @param {ConversationFilesDeps} options */
export function createConversationFiles(options) {
  const { convAt, CHG, VW } = options;
  const fileRoute = createFileRoute(options);
  /** @param {HTMLElement} btn */
  function openSharedFile(btn) {
    const raw = btn.dataset.fileBytes, n = raw == null || raw === "" ? NaN : Number(raw);
    const f = { path: btn.dataset.file, name: btn.dataset.fileName, type: btn.dataset.fileType, bytes: Number.isFinite(n) ? n : null };
    VW.open({ ...f, ...fileRoute(f.path, convAt(btn).view) }, btn);
  }
  /** @param {HTMLElement} a */
  function openLineRef(a) {
    const s = CHG.scope(convAt(a).view), path = /** @type {string} */ (a.dataset.ref);
    if (!s) return;
    /** @type {[number, number] | null} */
    const lines = a.dataset.refA ? [+a.dataset.refA, +/** @type {string} */ (a.dataset.refB)] : null;
    VW.open({ path, name: path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${path}` : path, ...(lines ? { lines } : {}) }, a);
  }
  return { fileRoute, openSharedFile, openLineRef };
}
