// @ts-check
import { createScope } from "../../kernel/scope.js";
import { workingRunCount } from "../world/run-count.js";
import { retryRead } from "./read-policy.js";

/** @import { Ctx } from "./types.d.ts" */

/** @param {Ctx} ctx @param {ReturnType<typeof import("./act.js").createAct>["listRuns"]} listRuns */
export function installWatchedRuns(ctx, listRuns) {
  /** @type {Map<string, { count: number; retire: () => void }>} */
  const requests = new Map();
  ctx.syncWatchedRuns = () => {
    const { reads, state, watched } = ctx;
    if (reads.signal.aborted) return;
    /** @type {Map<string, number>} */
    const needed = new Map();
    for (const id of [watched.thread, watched.side]) {
      if (!id) continue;
      const thread = state.threads.find((t) => t.id === id);
      if (!thread?.sessionId) continue;
      const session = thread.sessionId;
      const count = workingRunCount(thread, state.liveRuns[session]);
      needed.set(session, Math.max(needed.get(session) || 0, count));
    }
    for (const [session, request] of requests) if (needed.get(session) !== request.count) request.retire();
    for (const [session, count] of needed) {
      if (!count || requests.has(session)) continue;
      let known = 0;
      for (const r of state.runs.values()) {
        if (r.session === session && !r.hidden && (r.state === "running" || r.state === "waiting")) known++;
      }
      if (known >= count) continue;
      const scope = createScope();
      const retire = reads.effect(() => () => { requests.delete(session); scope.dispose(); });
      requests.set(session, { count, retire });
      void retryRead(scope, async (signal) => { await listRuns(session, { signal }); });
    }
  };
}
