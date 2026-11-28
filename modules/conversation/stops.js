// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createStopReceipt } from "./stop-receipt.js";

/** @import { Run, TurnStop } from "./stop-types.d.ts" */

/** @param {import("./stop-types.d.ts").StopDeps} options */
export function createConversationStops({ world, Kit, PROJ, announce, schedule, chatOf, pendingStops, heraldShow, dismissStops, inUse, running, workingRuns }) {
  /** @type {Map<string, TurnStop>} */
  const stops = new Map();
  const scope = createScope();
  scope.effect(() => () => stops.clear());
  const receipt = createStopReceipt({ heraldShow, announce, inUse });
  /** @param {string | null | undefined} session */
  const isStopping = (session) => !!session && stops.has(session);
  /** @param {Run} run */
  function stopLive(run, { interrupt = false, runs = 0 } = {}) {
    if (scope.signal.aborted) return;
    const what = run.kind === "thread" ? run.t.title : run.kind === "chat" ? "This chat" : run.conv === "ws" ? "The coordinator" : `${PROJ(chatOf(run.conv))} coordinator`;
    // the turn you chose to stop: if it ends inside the window and another starts, that one is left alone
    const token = { session: run.session, turn: world.act.turnOf(run.session), what, interrupt, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
    stops.set(run.session, token);
    stopsHerald();
    const also = runs ? ` and its ${runs} sub-agent${runs === 1 ? "" : "s"}` : "";
    announce(interrupt ? `Interrupting ${what}${also} in 3 seconds, so it reads your message next. Undo to let it finish.` : `Stopping ${what} in 3 seconds. Undo to keep it working.`);
    schedule();
    scope.timeout(async () => {
      if (token.cancelled) return;
      token.sent = true;
      stopsHerald();
      const now = world.act.turnOf(token.session);
      if (token.turn && now !== token.turn) {
        stops.delete(token.session);
        if (interrupt) {
          // its next turn is the one that reads your message
          heraldShow({ kind: "halt", text: "It had already finished", sub: `${what} · it reads your message next` }, 4200);
          announce("It had already finished that turn. It reads your message next.");
          schedule();
          return;
        }
        heraldShow({ kind: "halt", text: "It had already finished", sub: now ? `${what} · its next turn goes on` : what }, 4200);
        announce(now ? "It had already finished that turn. The next one goes on; Stop again to end it." : "It had already finished.");
        schedule();
        return;
      }
      try {
        const r = await world.act.stop(token.session);
        if (!scope.signal.aborted) receipt.sent(what, interrupt, r?.stopped === false);
      } catch (err) {
        if (!scope.signal.aborted) receipt.failed(what, interrupt, err, () => stopLive(run, { interrupt, runs }));
      } finally {
        if (stops.get(token.session) === token) stops.delete(token.session);
        if (!scope.signal.aborted) schedule();
      }
    }, Kit.COMMIT_MS);
  }
  // A single Undo covers the stops that are still pending.
  function stopsHerald() {
    const turns = [...stops.values()].filter((x) => !x.cancelled && !x.sent);
    const runs = pendingStops.pending();
    const all = [...turns, ...runs];
    if (!all.length) { dismissStops(); return; }
    const last = Math.max(...all.map((x) => x.until));
    const interrupt = !runs.length && turns.every((x) => x.interrupt);
    const undo = () => {
      for (const x of turns) { x.cancelled = true; if (stops.get(x.session) === x) stops.delete(x.session); }
      for (const j of runs) pendingStops.remove(j);
      announce(all.length > 1 ? "Not stopped. They keep working." : "Not stopped. It keeps working.");
      schedule();
    };
    heraldShow({
      kind: "halt", tag: "stops", text: interrupt ? "Interrupting" : "Stopping",
      sub: all.map((x) => x.what).join(", "), back: receipt.focusTargets(interrupt), undo, undoUntil: last, undoMs: Kit.COMMIT_MS,
    }, Math.max(300, last - Date.now()));
  }

  /** @param {string} [view] */
  function stopRun(view) {
    const run = running(view);
    if (run) stopLive(run);
  }
  /** @param {string} [view] */
  function interruptRun(view) {
    const run = running(view);
    if (run && run.kind === "thread") stopLive(run, { interrupt: true, runs: workingRuns(run.t) });
    else if (run && run.kind === "chat") stopLive(run, { interrupt: true });
  }

  return { stopsHerald, stopRun, interruptRun, isStopping, dispose: scope.dispose };
}
