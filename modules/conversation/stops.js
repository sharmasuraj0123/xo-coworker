// @ts-check

import { sound } from "../../core/services/sound.js";

/** @param {import("./stop-types.d.ts").StopDeps} options */
export function createConversationStops({ S, world, Kit, PROJ, announce, schedule, chatOf, pendingStops, heraldShow, heraldNext, inUse, running, workingRuns }) {
  /** @param {import("./stop-types.d.ts").Run} run */
  function stopLive(run, { interrupt = false, runs = 0 } = {}) {
    const what = run.kind === "thread" ? run.t.title : run.kind === "chat" ? "This chat" : run.conv === "ws" ? "The coordinator" : `${PROJ(chatOf(run.conv))} coordinator`;
    // the turn you chose to stop: if it ends inside the window and another starts, that one is left alone
    const token = { session: run.session, turn: world.act.turnOf(run.session), what, interrupt, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
    S.stops.set(run.session, token);
    stopsHerald();
    const also = runs ? ` and its ${runs} sub-agent${runs === 1 ? "" : "s"}` : "";
    announce(interrupt ? `Interrupting ${what}${also} in 3 seconds, so it reads your message next. Undo to let it finish.` : `Stopping ${what} in 3 seconds. Undo to keep it working.`);
    sound.play("back");
    schedule();
    setTimeout(async () => {
      if (token.cancelled) return;
      token.sent = true;
      stopsHerald();
      const now = world.act.turnOf(token.session);
      if (token.turn && now !== token.turn) {
        S.stops.delete(token.session);
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
        const done = r && r.stopped === false;
        if (interrupt) {
          heraldShow({ kind: "halt", text: done ? "It had already finished" : "Interrupted", sub: `${what} · it reads your message next` }, 4200);
          announce(done ? "It had already finished. It reads your message next." : `Interrupted ${what}. What it did is kept, and it reads your message next.`);
        } else {
          heraldShow({ kind: "halt", text: done ? "It had already finished" : "Stopped", sub: done ? what : `${what} · what it did is kept` }, 4200);
          announce(done ? "It had already finished." : `Stopped ${what}. What it did is kept.`);
        }
      } catch (err) {
        // Retry stops the same session, wherever you are when you press it
        heraldShow({ kind: "stopped", text: interrupt ? "Couldn't interrupt it" : "Couldn't stop it", sub: `${what} · ${(/** @type {Error} */ (err)).message}`, undo: () => stopLive(run, { interrupt, runs }), undoLabel: "Retry", back: interrupt ? [inUse("[data-interrupt]"), inUse("#send")] : [inUse("[data-chat-stop]"), inUse("#send")] }, 7000);
      } finally {
        if (S.stops.get(token.session) === token) S.stops.delete(token.session);
        schedule();
      }
    }, Kit.COMMIT_MS);
  }
  // A single Undo covers the stops that are still pending.
  function stopsHerald() {
    const turns = [...S.stops.values()].filter((x) => !x.cancelled && !x.sent);
    const runs = pendingStops.filter((j) => !j.cancelled && !j.sent);
    const all = [...turns, ...runs];
    if (!all.length) { if (S.herald && S.herald.tag === "stops") { S.herald.until = 0; heraldNext(); } return; }
    const last = Math.max(...all.map((x) => x.until));
    heraldShow({ kind: "halt", tag: "stops", text: all.every((x) => x.interrupt) ? "Interrupting" : "Stopping", sub: all.map((x) => x.what).join(", "), back: all.every((x) => x.interrupt) ? [inUse("[data-interrupt]"), inUse("#send")] : [inUse("[data-chat-stop]"), inUse("#send")], undo: () => {
      for (const x of turns) { x.cancelled = true; if (S.stops.get(x.session) === x) S.stops.delete(x.session); }
      for (const j of runs) { j.cancelled = true; const i = pendingStops.indexOf(j); if (i >= 0) pendingStops.splice(i, 1); }
      announce(all.length > 1 ? "Not stopped. They keep working." : "Not stopped. It keeps working.");
      schedule();
    } }, Math.max(300, last - Date.now()));
  }

  /** @param {string} [view] */
  function stopRun(view = S.view) {
    const run = running(view);
    if (run) stopLive(run);
  }
  /** @param {string} [view] */
  function interruptRun(view = S.view) {
    const run = running(view);
    if (run && run.kind === "thread") stopLive(run, { interrupt: true, runs: workingRuns(run.t) });
  }

  return { stopsHerald, stopRun, interruptRun };
}
