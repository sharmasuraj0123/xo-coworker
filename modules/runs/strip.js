// @ts-check
import { LIVE_RUN } from "./read.js";
import { runsStripHtml } from "./view.js";
import { workingRunCount } from "../../core/services/world/run-count.js";

/** @import { WorldState, WorldThread } from "../../core/services/world/state-types.d.ts" */

/** @typedef {Partial<Pick<WorldThread, "sessionId" | "runs">> & { session?: { live_runs?: number } | null }} RunStripThread */

/** @typedef {{ state: Partial<Pick<WorldState, "liveRuns" | "runs">> }} RunStripWorld */

/** @param {{ world: RunStripWorld, SHAPE: { on: (id: string) => boolean } }} options */
export function createRunsStrip({ world, SHAPE }) {
  /** @param {RunStripThread} t */
  function workingRuns(t) {
    return workingRunCount(t, t.sessionId ? world.state.liveRuns?.[t.sessionId] : undefined);
  }
  /** @param {RunStripThread} t */
  function runsStrip(t) {
    if (!t.sessionId || !world.state.runs) return "";
    const mine = [...world.state.runs.values()].filter((r) => r.session === t.sessionId && !r.hidden);
    const live = mine.filter((r) => LIVE_RUN(r) && (r.depth || 1) === 1);
    const total = Math.max((t.runs && t.runs.total) || 0, mine.length);
    // a shape without sub-agent counts (xo:thread/subagents) keeps only a sub-agent that waits on you
    if (!SHAPE.on("xo:thread/subagents")) return runsStripHtml(live.filter((r) => r.state === "waiting"), 0);
    return runsStripHtml(live, total);
  }
  return { runsStrip, workingRuns };
}
