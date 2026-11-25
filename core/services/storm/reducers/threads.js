// @ts-check
import { isThread, isThreadCard } from "../../../platform/chat-responses.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const threads = {
  thread(ctx, env, d) {
    const { state, rawThreads } = ctx;
    if (!isThread(d) || !d.ts) return;
    const ts = d.ts;
    const old = rawThreads.get(ts);
    if (!old && !d.chat_id) { ctx.refetchThread(env.chat_id, ts); return; }
    const now = Date.now();
    const thread = ctx.threadRecords.write(ts, {
      ...d, _at: now, ...("busy" in d ? { _readAt: now } : {}), ...ctx.sessRead(d, { at: now, seq: env.seq ?? state.lastSeq }),
      chat_id: d.chat_id || old?.chat_id || env.chat_id, updated_at: d.updated_at || env.ts || old?.updated_at,
    });
    if (thread && !thread.session) ctx.fillSession(thread.chat_id, ts);
    ctx.soon();
  },
  // the old thread froze and a linked new thread starts from its work
  "thread.continued"(ctx, env, d) {
    const { state, rawThreads } = ctx;
    const old = d.from || env.thread_ts;
    if (old) { state.moves[old] = { ...d, at: env.ts }; ctx.event({ kind: "moved", thread: old, project: ctx.projectOf(env.chat_id), to: d.to, agent: d.agent, by: d.by || null }); }
    if (env.chat_id && old) ctx.refetchThread(env.chat_id, old);
    if (env.chat_id && d.to && !rawThreads.has(d.to)) ctx.refetchThread(env.chat_id, d.to);
    ctx.soon();
  },
  // a coordinator steered, interrupted or stopped a thread: kept for the thread's timeline
  "thread.control"(ctx, env, d) {
    if (ctx.noteControl(env, d)) ctx.soon();
  },
  card(ctx, env, d) {
    const r = ctx.rawThreads.get(d.ts);
    if (!r || (d.card != null && !isThreadCard(d.card))) return;
    ctx.threadRecords.write(d.ts, { card: d.card, updated_at: env.ts || r.updated_at });
    ctx.soon();
  },
};
