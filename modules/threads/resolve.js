// @ts-check
import { once } from "../../core/platform/index.js";

/** @typedef {{ kind: "stopped" | "done", text: string, sub: string, mid: string, back: string[], undo: () => Promise<{ ok: boolean, why?: string }>, undoLabel?: string }} ResolveNotice */

/** @param {import("./resolve-types.d.ts").ResolveDeps} options */
export function createThreadResolve({ world, schedule, announce, heraldFor, heraldShow, heraldDrop }) {
  /** @param {string} tid @param {boolean} resolved */
  function resolveThread(tid, resolved, { undo = true, sayFail = true } = {}) {
    const p = once(`resolve:${tid}`, async () => {
      const t = world.thread(tid);
      if (!t) return { ok: false, why: "That thread isn't loaded." };
      const name = t.title;
      schedule(); // the button, drawn as waiting
      // Both outcomes replace the thread’s previous notice, even while it is queued.
      const about = `resolve:${tid}`;
      /** @param {ResolveNotice} h @param {number} ms */
      const say = (h, ms) => { if (!heraldFor(about, () => h, ms)) heraldShow(h, ms); };
      try {
        await world.act.resolve(tid, resolved);
      } catch (err) {
      announce(`${resolved ? "Couldn't resolve" : "Couldn't reopen"} ${name}. ${(/** @type {Error} */ (err)).message}`);
      if (sayFail) say({ kind: "stopped", text: resolved ? "Couldn't resolve it" : "Couldn't reopen it", sub: (/** @type {Error} */ (err)).message, mid: about, back: [`[data-resolve="${CSS.escape(tid)}"]`], undo: () => resolveThread(tid, resolved, { undo }), undoLabel: "Retry" }, 8000);
        else heraldDrop(about);
      return { ok: false, why: (/** @type {Error} */ (err)).message };
      }
      announce(resolved ? `Resolved ${name}.` : `Reopened ${name}.`);
      // Undo is the same call the other way (the route is idempotent); it never starts or stops a turn
      if (undo) say({ kind: "done", text: resolved ? "Resolved" : "Reopened", sub: name, mid: about, back: [`[data-resolve="${CSS.escape(tid)}"]`], undo: () => resolveThread(tid, !resolved, { undo: false }) }, 6000);
      else heraldDrop(about);
      return { ok: true };
    });
    p.finally(schedule); // drawn again once the request is no longer out
    return p;
  }
  return resolveThread;
}
