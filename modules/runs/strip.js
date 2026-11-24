// @ts-check
import { LIVE_RUN } from "./read.js";
import { runsStripHtml } from "./view.js";

/** @typedef {import("./types.d.ts").Run & { session: string, depth?: number, hidden?: boolean }} StoredRun */

/** @typedef {{ sessionId?: string, runs?: { running?: number, waiting?: number, total?: number }, session?: { live_runs?: number } }} RunStripThread */

/** @typedef {{ state: { liveRuns?: Record<string, { running: number, waiting: number }>, runs?: Map<string, StoredRun> }, act: { listRuns: (sid: string) => Promise<unknown> } }} RunStripWorld */

/** @param {{ world: RunStripWorld, SHAPE: { on: (id: string) => boolean }, schedule: () => void }} options */
export function createRunsStrip({ world, SHAPE, schedule }) {
  /** @type {Map<string, number>} */
  const runsAsked = new Map();
  /** @param {RunStripThread} t */
  function workingRuns(t) {
    const lr = (world.state.liveRuns || {})[/** @type {string} */ (t.sessionId)];
    return Math.max((t.runs && (t.runs.running || 0) + (t.runs.waiting || 0)) || 0, lr ? lr.running + lr.waiting : 0, (t.session && t.session.live_runs) || 0);
  }
  /** @param {RunStripThread} t */
  function runsStrip(t) {
    if (!t.sessionId || !world.state.runs) return "";
    const mine = [...world.state.runs.values()].filter((r) => r.session === t.sessionId && !r.hidden);
    const live = mine.filter((r) => LIVE_RUN(r) && (r.depth || 1) === 1);
    // after a reload the stream hasn't named the runs still working: the thread's counts know, so list them
    const working = workingRuns(t);
    // asked once per count: if the thread's counts stay stale after a read, the read isn't repeated
    if (working > mine.filter(LIVE_RUN).length && runsAsked.get(t.sessionId) !== working) {
      runsAsked.set(t.sessionId, working);
      world.act.listRuns(t.sessionId).then(() => schedule(), () => {});
    }
    const total = Math.max((t.runs && t.runs.total) || 0, mine.length);
    // a shape without sub-agent counts (xo:thread/subagents) keeps only a sub-agent that waits on you
    if (!SHAPE.on("xo:thread/subagents")) return runsStripHtml(live.filter((r) => r.state === "waiting"), 0);
    return runsStripHtml(live, total);
  }
  return { runsStrip, workingRuns };
}
