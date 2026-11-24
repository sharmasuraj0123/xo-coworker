// @ts-check

import { esc } from "../../core/platform/index.js";
import { activityOf } from "../../core/services/agent-activity.js";
import { folderOf } from "../../core/services/places.js";
import { parentOf } from "./scope.js";

/** @import { Turns, FileMark } from "../../core/services/types.d.ts" */

/** @import { ScopeThread, FilesScope } from "./scope.js" */

/** @typedef {ScopeThread & {title?: string, sessionId?: string | null, busy?: boolean, state?: string}} ActiveThread */

/** @typedef {Pick<FileMark, "mark" | "live" | "path" | "seq"> & {local: string | null, project: string, rel: string, who?: string, tid: string, busy: boolean}} Touch */

/** @type {Record<string, string>} */
const MARK_WORD = { new: "new", edited: "edited", deleted: "deleted" };

/** @param {FilesScope} s @param {{state: {turns: Turns, threads: ActiveThread[]}}} world @param {(thread: ActiveThread) => boolean} isBusy @returns {Touch[]} */
export function touched(s, world, isBusy) {
  if (!s.project) return [];
  const turns = world.state.turns;
  const ts = world.state.threads.filter((t) => t.project === s.project && (!s.tid || t.id === s.tid));
  /** @type {Map<string, Touch>} */
  const out = new Map();
  for (const t of ts) {
    const f = folderOf(t);
    if (!f || !t.sessionId) continue;
    const a = activityOf(turns, t.sessionId, f.root);
    for (const x of a.files.values()) {
      if (x.mark === "read" && !x.live) continue;
      // in a project, a thread's file is its worktree's: opening it reads that copy
      const local = s.base === f.base ? x.path : null;
      const at = { path: x.path, local, project: s.project, rel: f.base ? `${f.base}/${x.path}` : x.path, mark: x.mark, live: x.live, seq: x.seq, who: t.title, tid: t.id, busy: isBusy(t) };
      const prev = out.get(x.path);
      if (!prev || (at.live && !prev.live) || (at.busy && !prev.busy)) out.set(x.path, at);
    }
  }
  return [...out.values()].sort((a, b) => (/** @type {number} */ (/** @type {unknown} */ (b.live)) - /** @type {number} */ (/** @type {unknown} */ (a.live))) ||
    (/** @type {number} */ (/** @type {unknown} */ (b.busy)) - /** @type {number} */ (/** @type {unknown} */ (a.busy))) || b.seq - a.seq);
}
const markOf = (/** @type {Touch} */ x) => (x.live ? "live" : x.mark);

/** @param {Touch} x */
export const dot = (x, words = false) => `<span class="fl-who w-${markOf(x)}"${words ? "" : ` title="${esc(`${x.live ? "Being edited now" : MARK_WORD[/** @type {NonNullable<FileMark["mark"]>} */ (x.mark)] || x.mark} by ${x.who}`)}"`}><i></i>${words ? esc(x.live ? "editing now" : MARK_WORD[/** @type {NonNullable<FileMark["mark"]>} */ (x.mark)] || "") : ""}</span>`;

/** @param {Touch[]} tl */
export function marksOf(tl) {
  /** @type {Map<string, Touch>} */
  const files = new Map();
  /** @type {Map<string, ReturnType<typeof markOf>>} */
  const dirs = new Map();
  /** @type {Map<string, string>} */
  const sig = new Map();
  for (const x of tl) {
    if (x.local == null) continue;
    files.set(x.local, x);
    for (let p = parentOf(x.local); p; p = parentOf(p)) if (!dirs.has(p) || x.live) dirs.set(p, markOf(x));
  }
  const add = (/** @type {string} */ p, /** @type {string} */ v) => sig.set(p, (sig.get(p) || "") + v + "\n");
  for (const [p, x] of files) add(parentOf(p), `${p}:${markOf(x)}:${x.who}`);
  for (const [p, m] of dirs) add(parentOf(p), `${p}/:${m}`);
  return { files, dirs, sig };
}
