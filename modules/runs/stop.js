// @ts-check

/** @import { RunsStopOptions, RunStopResult } from "./stop-types.d.ts" */

/** @param {RunStopResult | null | undefined} r @param {string} what @param {boolean} all */
function stopReceipt(r, what, all) {
  const sent = !!r && (all ? Array.isArray(r.stopping) && r.stopping.length > 0 : r.stopping === true);
  if (sent) {
    const n = Array.isArray(r.stopping) ? r.stopping.length : 1;
    return { kind: "halt", text: "Stopping", sub: n > 1 ? `${n} sub-agents · what they did is kept` : `${what} · what it did is kept`, say: `Stopping ${what}. What it did is kept.` };
  }
  if (!all && r && r.stopping === false) return { kind: "halt", text: "It had already finished", sub: what, say: `${what} had already finished.` };
  if (all && r && Array.isArray(r.stopping) && !r.stopping.length) return { kind: "stopped", text: "No stop went out", sub: `${what}: none of them is running in a live session, though XO's record may still say they're working`, say: `No stop went out for ${what}: none of them is running in a live session.` };
  return { kind: "stopped", text: "Not confirmed", sub: `${what}: XO didn't confirm a stop was sent. Stop again if it keeps working.`, say: `XO didn't confirm the stop of ${what}.` };
}

/** @param {Pick<import('./controller-types.d.ts').RunsState, 'open' | 'session' | 'said'>} RS @param {RunsStopOptions} deps */
export function createRunsStop(RS, { pendingStops, stopsOut, stopsHerald, runsRender, announce, heraldShow, readRunsList, commitMs }) {
  /** @param {string} what @param {() => Promise<RunStopResult | null | undefined>} fn */
  return function stopRunsUndo(what, fn, key = what, session = RS.session) {
    if (pendingStops.some((j) => j.key === key && !j.cancelled) || stopsOut.has(key)) return;
    const job = { what, key, session, until: Date.now() + commitMs, cancelled: false, sent: false };
    if (RS.said && RS.said.key === key) RS.said = null; // a new stop of it: the last answer is over
    pendingStops.push(job);
    stopsHerald();
    runsRender();
    announce(`Stopping ${what} in 3 seconds. Undo to keep it.`);
    setTimeout(async () => {
      const i = pendingStops.indexOf(job);
      if (i >= 0) pendingStops.splice(i, 1);
      if (job.cancelled) return;
      job.sent = true;
      stopsHerald(); // its Undo is over: the line keeps only the stops still waiting
      stopsOut.add(key);
      RS.said = { key, kind: "halt", text: "Sending the stop…", sub: what };
      runsRender();
      try {
        const r = await fn();
        const said = stopReceipt(r, what, key.startsWith("all:"));
        heraldShow(said, said.kind === "halt" ? 3600 : 6000);
        RS.said = { key, ...said };
        announce(said.say);
      } catch (error) {
        const err = /** @type {import("../../core/platform/http.js").ApiError} */ (error);
        if (err.code === "run_not_live") {
          RS.said = { key, kind: "stopped", text: "Couldn't stop it", sub: `${what}: nothing is running it any more, though XO's record still says it's running` };
          heraldShow(RS.said, 6000);
          announce(`Couldn't stop ${what}: nothing is running it any more, though XO's record still says it's running.`);
        } else {
          RS.said = { key, kind: "stopped", text: "Couldn't stop it", sub: err.status === 501 ? "this agent can't stop a sub-agent; stop the thread instead" : err.message };
          heraldShow(RS.said, 6000);
          announce(`Couldn't stop ${what}: ${RS.said.sub}.`);
        }
      } finally { stopsOut.delete(key); }
      if (RS.open && RS.session === session) { await readRunsList(session); runsRender(); }
    }, commitMs);
  };
}
