// @ts-check
import { isPending, once } from "../../core/platform/pending.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { createThreadDeleteView } from "./delete-view.js";

/** @import { DeleteDeps, DeleteRefusal, ThreadDeletePrompt } from "./delete-types.d.ts" */

const UNDO_MS = 10_000;
const FAILURE_MS = 6_000;

/** @template Row @param {DeleteDeps<Row>} options */
export function createThreadDelete({ world, render, view, go, announce, heraldShow, PROJ }) {
  /** @type {ThreadDeletePrompt | null} */
  let active = null;
  let disposed = false;

  /** @param {string} tid */
  function ask(tid) {
    if (disposed) return;
    if (active?.id !== tid) active = { id: tid, loss: null };
    render();
  }

  function cancel() {
    const tid = active?.id ?? null;
    active = null;
    render();
    return tid;
  }

  /** @param {string} tid */
  async function confirm(tid) {
    const prompt = active;
    const thread = world.thread(tid);
    const remove = world.act.deleteThread;
    const key = `tdel:${tid}`;
    if (disposed || prompt?.id !== tid || !thread || !remove || isPending(key)) return;
    const matches = () => active === prompt && view() === "t:" + tid;
    const token = prompt.loss?.confirm || null;
    try {
      const p = once(key, () => remove.call(world.act, tid, { keepBranch: true, confirm: token }));
      render();
      const result = await p;
      if (disposed) return;
      const stay = view() === "t:" + tid;
      if (active === prompt) active = null;
      if (stay) go("p:" + thread.project);
      heraldShow({
        kind: "done",
        text: `“${thread.title}” deleted`,
        sub: thread.branch ? `Its branch ${thread.branch} is kept` : PROJ(thread.project),
        async undo() {
          if (disposed) return;
          try {
            await world.act.restoreThread(tid, result.row);
            if (!disposed) announce("Thread back");
          } catch (error) {
            if (disposed) return;
            const text = "Couldn't bring it back";
            requestFailureMessage(error, text);
            heraldShow({ kind: "stopped", text, sub: thread.title, force: true }, FAILURE_MS);
          }
        },
        undoUntil: result.undo_until ? Date.parse(result.undo_until) : Date.now() + UNDO_MS,
        ownFocus: true,
      }, UNDO_MS);
    } catch (error) {
      if (disposed) return;
      if (error && typeof error === "object" && "code" in error && error.code === "would_lose_work") {
        if (matches()) {
          const loss = /** @type {DeleteRefusal} */ (error);
          prompt.loss = { summary: loss.what?.summary || null, confirm: loss.confirm || loss.what?.confirm || null };
          render();
        }
        return;
      }
      const text = "Couldn't delete the thread";
      heraldShow({ kind: "stopped", text, sub: requestFailureMessage(error, text), force: true }, FAILURE_MS);
    }
  }
  return {
    ask, cancel, confirm, render: createThreadDeleteView(() => active),
    dispose() { disposed = true; active = null; },
  };
}
