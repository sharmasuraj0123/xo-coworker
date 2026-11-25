// @ts-check
import { text, number, strings } from "../../world/frame-values.js";
import { statusLater, sessionRead } from "../../world/sessions.js";
import { BUSY, COORD } from "../config.js";

/** @typedef {import("../types").Reducer} Reducer @typedef {import("../types").Ctx} Ctx */

/** A session read, taken in the stream's order, and the end of "replying". @param {Ctx} ctx */
export function installSessionReads(ctx) {
  const { state } = ctx;
  // a read's seq is the session's creation, not its last word: what is newer is decided by where the read was sent
  ctx.noteSession = (s, sent = ctx.sentAt()) => {
    const old = state.sessions[s.id];
    const next = { ...(old || {}), ...s, paused: s.paused || null, retired_at: s.retired_at || null, seq: s.seq ?? null, ...sessionRead(s),
      ...(s.state ? { statusAt: sent.at, statusSeq: sent.seq } : {}) };
    // a status frame that came after this read was sent is newer than what the read says: it stands
    if (old && old.state && s.state && statusLater(old, next)) Object.assign(next, { state: old.state, waiting: old.waiting ?? null, statusAt: old.statusAt, statusSeq: old.statusSeq });
    // and so does any word a frame said since (paused, resumed); a retirement is never undone by a read
    if (old && old.frameSeq != null && sent.seq != null && old.frameSeq > sent.seq) next.paused = old.paused ?? null;
    if (old && old.retired_at && !next.retired_at) next.retired_at = old.retired_at;
    state.sessions[s.id] = next;
  };
  // the coordinator went quiet; if it answered, the message frame already cleared this
  ctx.settleAwaiting = (chatId) => {
    const project = ctx.projectOf(chatId);
    if (!project || !state.awaiting[project]) return;
    const aw = state.awaiting[project];
    if (Date.now() - aw.at > 1500) { delete state.awaiting[project]; ctx.soon(); }
  };
}

/** @type {Record<string, Reducer>} */
export const sessions = {
  session(ctx, env, d) {
    const { state } = ctx;
    const id = env.session_id;
    if (!id) return;
    const old = state.sessions[id] || { id };
    /** @type {import("../types").Session} */
    const next = { ...old, chat_id: old.chat_id || env.chat_id || null, thread_ts: old.thread_ts || env.thread_ts || null, state: text(d.status) || old.state, seq: old.seq ?? env.seq ?? null, frameSeq: env.seq ?? state.lastSeq };
    // what a gate holds it for, while queued; any other status ends the wait
    if (typeof d.status === "string" && d.status) {
      next.waiting = d.status === "queued" && d.waiting && typeof d.waiting === "object" ? d.waiting : null;
      next.statusAt = Date.now(); next.statusSeq = env.seq ?? state.lastSeq;
    }
    if (d.reason === "created") Object.assign(next, { role: text(d.role), agent: text(d.agent), preset: text(d.preset) });
    if (d.reason === "paused") next.paused = d.why || "paused";
    if (d.reason === "resumed") next.paused = null;
    if (d.reason === "updated") {
      next.model = text(d.model) ?? old.model;
      next.effort = text(d.effort) ?? old.effort;
      next.permission_mode = text(d.permission_mode) ?? old.permission_mode;
    }
    if (d.reason === "attached" && typeof d.native_id === "string") next.native_id = d.native_id;
    if (d.reason === "retired") next.retired_at = env.ts || new Date().toISOString();
    // an unconfirmed "send now" was added to the running turn instead
    if (d.reason === "now_became_add") ctx.event({ kind: "now_became_add", session: id, wakes: strings(d.wakes) || [], runs: number(d.runs) || 0 });
    state.sessions[id] = next;
    // a turn for our message ended: "replying" ends with it; a failure is said plainly
    if (next.role && COORD.has(next.role) && !BUSY.has(next.state ?? "")) ctx.settleAwaiting(next.chat_id ?? null);
    ctx.soon();
  },
  "turn.started"(ctx, env) {
    if (env.session_id && (ctx.state.sessions[env.session_id] || {}).state === "queued") ctx.soon();
  },
  "turn.finished"(ctx, _env, d, tid) {
    const { state } = ctx;
    const t = tid && state.turns.get(tid);
    if (!t) return;
    if (t.session && state.sessions[t.session]?.role === "plain") ctx.event({ kind: "chat_turn_finished", session: t.session });
    const project = ctx.projectOf(t.chat);
    const aw = project && state.awaiting[project];
    const wake = aw && `msg:${aw.id}`;
    const mine = aw && (t.wakes || []).includes(`msg:${aw.id}`);
    const requeued = !!wake && (strings(d.wakes_requeued) || []).includes(wake);
    // "interrupted" (a restart) puts the wake back: the coordinator still answers, so we keep waiting
    if (mine && d.status === "failed" && !requeued) {
      const p = /** @type {string} */ (project);
      state.failed[p] = { at: Date.now(), error: text(d.error) || text(d.reason) || text(d.stop_reason) || "the turn failed", id: aw.id };
      delete state.awaiting[p];
      ctx.event({ kind: "coord_failed", project: p, text: state.failed[p].error });
    }
    ctx.soon();
  },
};
