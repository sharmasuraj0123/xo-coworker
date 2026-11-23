// @ts-check
import { sharedFileRoute } from "../../core/services/world/relay.js";

/** @param {import("./conversation-files-types.d.ts").ConversationFilesDeps} options */
export function createConversationFiles({ currentView, convThread, convAt, CHG, VW }) {
  /** @param {string | null | undefined} path */
  function fileRoute(path, conv = currentView()) {
    const t = convThread(conv);
    const pid = !t && conv.startsWith("p:") ? conv.slice(2) : null;
    const rel = String(path || "").replace(/^\.\//, "");
    return pid && rel && !rel.startsWith("/") && !rel.split("/").some((x) => x === ".." || x === "") ? { project: pid, rel } : sharedFileRoute(t, path);
  }
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
