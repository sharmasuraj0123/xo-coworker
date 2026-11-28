// @ts-check

import { cancelLatest, latest } from "../../core/platform/latest.js";
import { createRunTranscript, LIVE_RUN } from "./transcript.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { Run } from "./types.d.ts" */

/** @import { RunsReadDeps } from "./read-types.d.ts" */

export { LIVE_RUN };

/** @param {RunsReadDeps} options */
export function createRunsReads({ RS, world, STAGE, runsRender, scope }) {
  const { signal } = scope;
  const listKey = Symbol("runs list");
  const detailKey = Symbol("run detail");
  const transcript = createRunTranscript({ RS, world, scope, runsRender });

  function cancelDetail() {
    cancelLatest(detailKey);
    transcript.cancel();
  }

  /** @param {string} sid */
  async function readRunsList(sid, my = RS.opening) {
    const mine = () => !signal.aborted && RS.open && RS.session === sid && RS.opening === my;
    try {
      await latest(listKey, (active) => world.act.listRuns(sid, { signal: active }), { signal,
        commit(reply) {
          if (!mine()) return;
          RS.tree = reply.runs || [];
          RS.counts = reply.counts || null;
          RS.listState = "ok";
          RS.listErr = "";
        },
      });
    } catch (error) {
      if (!mine() || error instanceof Error && error.name === "AbortError") return false;
      RS.listState = "error";
      RS.listErr = requestFailureMessage(error, "Couldn't read its sub-agents.");
    }
    return mine();
  }
  /** @param {string} id */
  async function openRun(id) {
    cancelDetail();
    if (signal.aborted) return;
    const gen = ++RS.gen; // a read for another run (or a closed sheet) never writes into this one
    Object.assign(RS, { runCmds: false, view: "run", runId: id, run: world.state.runs.get(id) || null, anc: null, items: [], cursor: null, children: [], loading: true, error: null, gone: null, keepScroll: false });
    runsRender(); STAGE.repaint();
    try {
      const r = await latest(detailKey, (active) => world.act.run(id, { signal: active }), { signal });
      if (signal.aborted || gen !== RS.gen) return;
      RS.run = { ...(world.state.runs.get(id) || {}), ...r, title: r.title || r.agent_type || "Sub-agent" };
      RS.anc = r.ancestry || null;
      /** @param {Run[] | undefined} nodes @returns {Run[] | null} */
      const findKids = (nodes) => { for (const n of nodes || []) { if (n.id === id) return n.children || []; const k = findKids(n.children); if (k) return k; } return null; };
      RS.children = findKids(RS.tree) || [];
    } catch (error) {
      if (gen !== RS.gen || signal.aborted || error instanceof Error && error.name === "AbortError") return;
      RS.error = requestFailureMessage(error, "Couldn't read this sub-agent.");
    }
    STAGE.repaint();
    await transcript.read(id, gen);
  }
  return { readRunsList, openRun, cancelDetail, cancelList: () => cancelLatest(listKey) };
}
