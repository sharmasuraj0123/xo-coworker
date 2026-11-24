// @ts-check
import { $ } from "../../core/platform/dom.js";
import { isPending, once } from "../../core/platform/pending.js";

/** @import { DeleteDeps, DeleteRefusal } from "./delete-types.d.ts" */

/** @template Row @param {DeleteDeps<Row>} options */
export function createThreadDelete({ S, world, render, go, announce, heraldShow, PROJ }) {
  /** @param {string} tid */
  async function deleteThread(tid) {
    const t = world.thread(tid);
    if (!t || !world.act.deleteThread) return;
    const pid = t.project;
    try {
      if (isPending(`tdel:${tid}`)) return; // already on its way
      const p = once(`tdel:${tid}`, () => (/** @type {NonNullable<typeof world.act.deleteThread>} */ (world.act.deleteThread))(tid, { keepBranch: true, confirm: S.tDelLose?.confirm || null }));
      render();
      const res = await p;
      S.tDel = null; S.tDelLose = null;
      go("p:" + pid);
      heraldShow({ kind: "done", text: `“${t.title}” deleted`, sub: t.branch ? `Its branch ${t.branch} is kept` : PROJ(pid),
        undo: () => world.act.restoreThread(tid, res.row).then(() => announce("Thread back"), () => heraldShow({ kind: "stopped", text: "Couldn't bring it back", sub: t.title, force: true }, 6000)),
        undoUntil: res.undo_until ? Date.parse(res.undo_until) : Date.now() + 10000, ownFocus: true }, 10000);
    } catch (err) {
      // work kept nowhere else: say what, and ask again (the next press sends Space's confirm token)
      if (err && (/** @type {DeleteRefusal} */ (err)).code === "would_lose_work") { S.tDelLose = { summary: (/** @type {DeleteRefusal} */ (err)).what?.summary || null, confirm: (/** @type {DeleteRefusal} */ (err)).confirm || (/** @type {DeleteRefusal} */ (err)).what?.confirm || null }; $("#top-who")._h = null; render(); return; }
      heraldShow({ kind: "stopped", text: "Couldn't delete the thread", sub: String(err && (/** @type {Error} */ (err)).message || err), force: true }, 6000);
    }
  }
  return deleteThread;
}
