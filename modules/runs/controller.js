// @ts-check

/** @import { RunsState, RunsOpening } from "./controller-types.d.ts" */

/** @param {RunsState} RS @param {RunsOpening} deps */
export function createRunsOpener(RS, { STAGE, headFor, readRunsList, openRun, runsRender, runsLand }) {
  /** @param {{ sessionId?: string | null, title: string } | null | undefined} t @param {string | null} runId */
  return async function openRuns(t, runId = null) {
    if (!t || !t.sessionId) return;
    if (!RS.open) { RS.returnTo = document.activeElement; RS.head = headFor(RS.returnTo); }
    if (RS.session !== t.sessionId) { RS.tree = []; RS.counts = null; RS.said = null; }
    const my = ++RS.opening;
    if (!RS.open) Object.assign(RS, { panelWas: STAGE.isOpen, cmdsOpen: true, cmdsAll: false });
    Object.assign(RS, { open: true, session: t.sessionId, title: t.title, view: runId ? "run" : "list", runId, keepScroll: false, listState: "loading", listErr: "" });
    if (!STAGE.show("runs", t.sessionId)) { RS.open = false; return; }
    await readRunsList(t.sessionId, my);
    if (!RS.open || RS.session !== t.sessionId || RS.opening !== my) return;
    if (runId) openRun(runId); else { runsRender(); runsLand()?.focus(); }
  };
}
