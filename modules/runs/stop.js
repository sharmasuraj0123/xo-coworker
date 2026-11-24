// @ts-check

import { failedStopReceipt, stopReceipt } from "./stop-receipt.js";

/** @import { RunsStopOptions, RunStopResult } from "./stop-types.d.ts" */

/** @param {Pick<import('./controller-types.d.ts').RunsState, 'open' | 'session' | 'said'>} RS @param {RunsStopOptions} deps */
export function createRunsStop(RS, {
  pendingStops, stopsOut, stopsHerald, runsRender, announce, heraldShow, readRunsList, commitMs, scope,
}) {
  /** @param {string} what @param {() => Promise<RunStopResult | null | undefined>} fn */
  return function stopRunsUndo(what, fn, key = what, session = RS.session) {
    if (scope.signal.aborted || stopsOut.has(key)) return;
    const job = { what, key, session, until: Date.now() + commitMs };
    if (!pendingStops.add(job)) return;
    if (RS.said && RS.said.key === key) RS.said = null; // a new stop of it: the last answer is over
    stopsHerald();
    runsRender();
    announce(`Stopping ${what} in 3 seconds. Undo to keep it.`);
    const clearJob = scope.effect(() => () => { pendingStops.remove(job); });
    scope.timeout(async () => {
      const pending = pendingStops.remove(job);
      clearJob();
      if (!pending) return;
      stopsHerald(); // its Undo is over: the line keeps only the stops still waiting
      stopsOut.add(key);
      if (RS.session === session) RS.said = { key, kind: "halt", text: "Sending the stop…", sub: what };
      runsRender();
      let said;
      try { said = stopReceipt(await fn(), what, key.startsWith("all:")); }
      catch (error) {
        if (scope.signal.aborted) return;
        said = failedStopReceipt(error, what);
      } finally { stopsOut.delete(key); }
      if (scope.signal.aborted) return;
      if (RS.session === session) RS.said = { key, ...said };
      heraldShow(said, said.kind === "halt" ? 3600 : 6000);
      announce(said.say);
      if (RS.open && RS.session === session && await readRunsList(session)) runsRender();
    }, commitMs);
  };
}
