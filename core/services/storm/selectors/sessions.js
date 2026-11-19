// @ts-check
import { heldOf, queuedButWorking, statusLater, readSub, sessionBusy } from "../../world/sessions.js";
import { BUSY, COORD } from "../config.js";

/** @typedef {import("../types").Ctx} Ctx @typedef {import("../types").Session} Session */

/** Which chat, project and session is whose, and what a session is doing now, by the stream's order. @param {Ctx} ctx */
export function installSessions(ctx) {
  const { state, chatProject, watched } = ctx;

  ctx.projectOf = (chatId) => (chatId ? chatProject.get(chatId) || null : null);
  ctx.chatIdOf = (project) => state.projects.find((p) => p.id === project)?.chatId || null;
  ctx.isWatched = (ts) => !!ts && (ts === watched.thread || ts === watched.side);

  // the current coordinator is chosen before activity: an older session's queued never makes this chat busy or Stop's target
  ctx.coordinatorOf = (chat) => {
    if (!chat) return null;
    /** @type {Session | null} */
    let current = null;
    for (const s of Object.values(state.sessions)) {
      if (s.chat_id !== chat || !COORD.has(s.role) || s.retired_at) continue;
      if (!current || (s.seq || 0) > (current.seq || 0)) current = s;
    }
    return current;
  };

  // a frame stands at its own seq; an HTTP read at the newest seq seen when it was SENT, never when it came back
  ctx.sentAt = () => ({ at: Date.now(), seq: state.lastSeq ?? null });
  ctx.sessRead = (x, sent) => (x && x.session && typeof x.session === "object" ? { _sessAt: sent.at, _seqAt: sent.seq } : {});

  /** The live record, or a thread view's `session` when that read is newer than the live record's last status. */
  ctx.sessionNow = (sid, r = null) => {
    const live = sid ? state.sessions[sid] : null;
    const view = r && r.session && r.session.state ? { ...r.session, id: sid, statusAt: r._sessAt || 0, statusSeq: r._seqAt ?? null } : null;
    if (live && live.state && (!view || !statusLater(view, live))) return live;
    return view ? /** @type {Session} */ ({ ...(live || {}), ...view }) : live || null;
  };
  ctx.evidenceOf = (sid, runs = null) => ({ runs: runs || [...state.runs.values()].filter((x) => x.session === sid), agg: state.liveRuns[sid] || null, turn: state.turns.running(sid) });
  /** On a turn now: its status says so, or it says queued and work has been seen since. */
  ctx.onTurn = (s) => !!s && (BUSY.has(s.state) || queuedButWorking(s, ctx.evidenceOf(s.id)));
  /** What a session held back by a gate waits for, or null; an older backend names no reason, so its pool is read. */
  ctx.heldOfSession = (s, runs = null) => {
    if (!s || s.state !== "queued" || queuedButWorking(s, ctx.evidenceOf(s.id, runs))) return null;
    return heldOf({ ...s, pool: s.pool || ctx.agentPool(s.agent) }, state.pools);
  };
  ctx.agentPool = (agent) => {
    const rt = agent ? (state.runtimes || []).find((/** @type {any} */ x) => x.name === agent) : null;
    return (rt && rt.health && rt.health.pool) || (rt && rt.cli && rt.cli.account ? `${agent}:${rt.cli.account}` : null);
  };
  /** A thread's agent at work: its session's newest status, and the session list's or this view's `busy`, whichever came later. */
  ctx.threadBusy = (r, now, runsBy) => {
    const sid = r.session_id;
    if (!sid || !now) return false;
    const live = state.sessions[sid];
    const view = r.session ? { sub: readSub({ state: r.session.state, busy: typeof r.session.busy === "boolean" ? r.session.busy : r.busy }), readAt: r._readAt || 0 } : null;
    const ok = (/** @type {any} */ x) => x && x.sub !== undefined;
    const read = ok(live) && (!ok(view) || (live.readAt || 0) >= /** @type {any} */ (view).readAt) ? live : ok(view) ? view : null;
    return sessionBusy({ id: sid, state: now.state, statusAt: now.statusAt, statusSeq: now.statusSeq, sub: read ? read.sub : undefined, readAt: read ? read.readAt || 0 : 0 }, ctx.evidenceOf(sid, runsBy.get(sid) || []));
  };
}
