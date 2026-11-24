// @ts-check
import { LIVE_RUN } from "./read.js";
import { runsStripHtml } from "./view.js";
import { createScope } from "../../core/kernel/scope.js";
import { createLru } from "../../core/platform/cache.js";
import { isPending, once } from "../../core/platform/pending.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { WorldState, WorldThread } from "../../core/services/world/state-types.d.ts" */

/** @typedef {Partial<Pick<WorldThread, "sessionId" | "runs">> & { session?: { live_runs?: number } | null }} RunStripThread */

/** @typedef {{ state: Partial<Pick<WorldState, "liveRuns" | "runs">>, act: Parameters<typeof createRunsWarm>[0] }} RunStripWorld */

/** @param {{ world: RunStripWorld, SHAPE: { on: (id: string) => boolean }, schedule: () => void }} options */
export function createRunsStrip({ world, SHAPE, schedule }) {
  const { warm, dispose } = createRunsWarm(world.act, schedule);
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
    const working = workingRuns(t);
    if (working > mine.filter(LIVE_RUN).length) warm(t.sessionId, working);
    const total = Math.max((t.runs && t.runs.total) || 0, mine.length);
    // a shape without sub-agent counts (xo:thread/subagents) keeps only a sub-agent that waits on you
    if (!SHAPE.on("xo:thread/subagents")) return runsStripHtml(live.filter((r) => r.state === "waiting"), 0);
    return runsStripHtml(live, total);
  }
  return { runsStrip, workingRuns, dispose };
}

const RECENT_SESSIONS = 100;
/** @typedef {{ count?: number, controller?: AbortController }} SessionRead */

/** @param {{ listRuns: (session: string, options: { signal: AbortSignal }) => Promise<unknown> }} act @param {() => void} schedule */
function createRunsWarm(act, schedule) {
  const scope = createScope();
  /** @type {ReturnType<typeof createLru<string, SessionRead>>} */
  const registry = createLru({ max: RECENT_SESSIONS, onEvict: (entry) => entry.controller?.abort() });
  scope.effect(() => () => registry.clear());

  /** @param {string} session @param {number} count */
  function warm(session, count) {
    if (scope.signal.aborted) return;
    const entry = registry.get(session) || {};
    if (entry.count === count || isPending(entry)) return;
    entry.controller = new AbortController();
    const readSignal = AbortSignal.any([scope.signal, entry.controller.signal]);
    registry.set(session, entry);
    void once(entry, async () => {
      try {
        readSignal.throwIfAborted();
        await act.listRuns(session, { signal: readSignal });
        readSignal.throwIfAborted();
      } catch (error) {
        if (!readSignal.aborted) requestFailureMessage(error, "Couldn't read this thread's sub-agents.");
        return;
      } finally {
        entry.controller = undefined;
      }
      entry.count = count;
      schedule();
    });
  }

  return { warm, dispose: scope.dispose };
}
