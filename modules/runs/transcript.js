// @ts-check

import { cancelLatest, latest } from "../../core/platform/latest.js";
import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { RunsReadDeps } from "./read-types.d.ts" */

/** @import { Run } from "./types.d.ts" */

const RUN_POLL_MS = 2500;
const TRANSCRIPT_PAGE_CAP = 20;

/** @param {Pick<Run, "state">} r */
export const LIVE_RUN = (r) => r.state === "running" || r.state === "waiting";

/** @param {Pick<RunsReadDeps, "RS" | "world" | "scope" | "runsRender">} options */
export function createRunTranscript({ RS, world, scope, runsRender }) {
  const { signal } = scope;
  const transcriptKey = Symbol("run transcript");
  /** @type {(() => void) | undefined} */
  let cancelPoll;

  function cancel() {
    cancelLatest(transcriptKey);
    cancelPoll?.();
    cancelPoll = undefined;
  }

  /** @param {string} id @param {number} gen */
  async function readTranscript(id, gen) {
    const mine = () => !signal.aborted && RS.gen === gen && RS.runId === id && RS.open;
    if (!mine()) return;
    try {
      await latest(transcriptKey, async (active) => {
        let more = true, guard = 0;
        while (more && guard++ < TRANSCRIPT_PAGE_CAP) {
          const d = await world.act.transcript(id, RS.cursor, { signal: active });
          if (active.aborted || !mine()) return;
          const have = new Set(RS.items.map((i) => i.id));
          RS.items.push(...(d.items || []).filter((i) => !have.has(i.id)));
          if (d.next) RS.cursor = d.next;
          more = !!d.next && (d.items || []).length > 0;
          if (more) { RS.loading = false; RS.keepScroll = true; runsRender(); }
        }
      }, { signal });
    } catch (err) {
      if (!mine() || err instanceof Error && err.name === "AbortError") return;
      if (err instanceof ApiError && err.code === "transcript_gone") {
        RS.gone = "summary" in err && typeof err.summary === "string" && err.summary ? err.summary : err.message;
      }
      else if (err instanceof ApiError && err.status === 501) RS.error = "This agent can't show a sub-agent's work.";
      else RS.error = requestFailureMessage(err, "Couldn't read this sub-agent's work.");
    }
    if (!mine()) return;
    RS.loading = false;
    RS.keepScroll = true;
    runsRender();
    const live = world.state.runs.get(id);
    if (mine() && (!live || LIVE_RUN(live)) && !RS.gone && !RS.error) {
      cancelPoll = scope.timeout(() => { cancelPoll = undefined; void readTranscript(id, gen); }, RUN_POLL_MS);
    }
  }
  return { read: readTranscript, cancel };
}
