// @ts-check

/** @import { Run } from "./stop-types.d.ts" */

/** @param {import("./running-types.d.ts").RunningDeps} options */
export function createRunningState({ S, world, CH, convThread, chatOf }) {
  return function running(view = S.view) {
    /** @template {Run} T @param {T} run */
    const live = (run) => (run && !S.stops.has(run.session) && world.act.sessionState(run.session) !== "stopping" ? run : null);
    const t = convThread(view);
    if (t) return t.busy && t.sessionId ? live({ kind: "thread", t, session: t.sessionId }) : null;
    if (view.startsWith("c:")) return CH.busy(view) ? live({ kind: "chat", session: view.slice(2) }) : null;
    if (view === "chats") return null;
    const chat = chatOf(view);
    const sid = chat && world.act.coordinatorBusy ? world.act.coordinatorBusy(chat) : null;
    return sid ? live({ kind: "coord", conv: view, session: sid }) : null;
  };
}
