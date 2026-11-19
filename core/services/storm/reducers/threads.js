// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const threads = {
  thread(ctx, env, d) {
    const { state, rawThreads } = ctx;
    const ts = d.ts;
    if (!ts) return;
    const old = rawThreads.get(ts);
    if (!old && !d.chat_id) { ctx.refetchThread(env.chat_id, ts); return; }
    rawThreads.set(ts, { ...(old || {}), ...d, _at: Date.now(), ...("busy" in d ? { _readAt: Date.now() } : {}), ...ctx.sessRead(d, { at: Date.now(), seq: env.seq ?? state.lastSeq }), chat_id: d.chat_id || (old && old.chat_id) || env.chat_id, updated_at: d.updated_at || env.ts || (old && old.updated_at) });
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
    if (r) { ctx.rawThreads.set(d.ts, { ...r, card: d.card, updated_at: env.ts || r.updated_at }); ctx.soon(); }
  },
};
