// @ts-check

/** @import { Run } from "./types.d.ts" */

/** @import { RunsReadDeps, RunError } from "./read-types.d.ts" */

/** @param {Pick<Run, "state">} r */
export const LIVE_RUN = (r) => r.state === "running" || r.state === "waiting";

/** @param {RunsReadDeps} options */
export function createRunsReads({ RS, world, STAGE, runsRender }) {
  /** @param {string} sid */
  async function readRunsList(sid, my = RS.opening) {
    const mine = () => RS.open && RS.session === sid && RS.opening === my;
    try {
      const d = await world.act.listRuns(sid);
      if (!mine()) return false;
      RS.tree = d.runs || []; RS.counts = d.counts || null; RS.listState = "ok"; RS.listErr = "";
    } catch (err) {
      if (!mine()) return false;
      RS.listState = "error"; RS.listErr = (/** @type {Error} */ (err)).message;
    }
    return true;
  }
  /** @param {string} id */
  async function openRun(id) {
    clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (RS.pollT));
    const gen = ++RS.gen; // a read for another run (or a closed sheet) never writes into this one
    Object.assign(RS, { runCmds: false, view: "run", runId: id, run: world.state.runs.get(id) || null, anc: null, items: [], cursor: null, children: [], loading: true, error: null, gone: null, keepScroll: false });
    runsRender(); STAGE.repaint();
    try {
      const r = await world.act.run(id);
      if (gen !== RS.gen) return;
      RS.run = { ...(world.state.runs.get(id) || {}), ...r, title: r.title || r.agent_type || "Sub-agent" };
      RS.anc = r.ancestry || null;
      /** @param {Run[] | undefined} nodes @returns {Run[] | null} */
      const findKids = (nodes) => { for (const n of nodes || []) { if (n.id === id) return n.children || []; const k = findKids(n.children); if (k) return k; } return null; };
      RS.children = findKids(RS.tree) || [];
    } catch (err) { if (gen !== RS.gen) return; RS.error = (/** @type {Error} */ (err)).message; }
    STAGE.repaint();
    await readTranscript(id, gen);
  }
  /** @param {string} id @param {number} gen */
  async function readTranscript(id, gen) {
    const mine = () => RS.gen === gen && RS.runId === id && RS.open;
    if (!mine()) return;
    try {
      let more = true, guard = 0;
      while (more && guard++ < 20) {
        const d = await world.act.transcript(id, RS.cursor);
        if (!mine()) return;
        const have = new Set(RS.items.map((i) => i.id));
        RS.items.push(...(d.items || []).filter((i) => !have.has(i.id)));
        if (d.next) RS.cursor = d.next;
        more = !!d.next && (d.items || []).length > 0;
        // a long transcript shows as each page arrives, not after the last one
        if (more) { RS.loading = false; RS.keepScroll = true; runsRender(); }
      }
    } catch (err) {
      if (!mine()) return;
      if ((/** @type {RunError} */ (err)).code === "transcript_gone") RS.gone = (/** @type {RunError} */ (err)).summary || (/** @type {Error} */ (err)).message;
      else if ((/** @type {RunError} */ (err)).status === 501) RS.error = "This agent can't show a sub-agent's work.";
      else RS.error = (/** @type {Error} */ (err)).message;
    }
    RS.loading = false;
    RS.keepScroll = true;
    runsRender();
    const live = world.state.runs.get(id);
    if (mine() && (!live || LIVE_RUN(live)) && !RS.gone && !RS.error) RS.pollT = setTimeout(() => readTranscript(id, gen), 2500);
  }
  return { readRunsList, openRun };
}
