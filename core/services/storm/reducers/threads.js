// @ts-check
import { invalidField, rejectFrame } from "../frame-failures.js";
import { text } from "../../world/frame-values.js";
import { isThread, isThreadCard } from "../../../platform/chat-responses.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const threads = {
  thread(ctx, env, d) {
    const { state, rawThreads } = ctx;
    if (!isThread(d) || !d.ts) return rejectFrame(ctx, "thread", d.ts ? invalidField(d, { ts: "thread" }, isThread) : "ts");
    const ts = d.ts;
    const old = rawThreads.get(ts);
    if (!old && !d.chat_id) { ctx.refetchThread(env.chat_id, ts); return; }
    const now = Date.now();
    const thread = ctx.threadRecords.write(ts, {
      ...d, _at: now, ...("busy" in d ? { _readAt: now } : {}), ...ctx.sessRead(d, { at: now, seq: env.seq ?? state.lastSeq }),
      chat_id: d.chat_id || old?.chat_id || env.chat_id || undefined, updated_at: d.updated_at || env.ts || old?.updated_at,
    });
    if (thread && !thread.session) ctx.fillSession(thread.chat_id, ts);
    ctx.soon();
  },
  // the old thread froze and a linked new thread starts from its work
  "thread.continued"(ctx, env, d) {
    const { state, rawThreads } = ctx;
    const old = text(d.from) || env.thread_ts;
    const to = text(d.to);
    if (old) { state.moves[old] = { to, text: text(d.text), at: env.ts ?? "" }; ctx.event({ kind: "moved", thread: old, project: ctx.projectOf(env.chat_id), to, agent: text(d.agent), by: text(d.by) || null }); }
    if (env.chat_id && old) ctx.refetchThread(env.chat_id, old);
    if (env.chat_id && to && !rawThreads.has(to)) ctx.refetchThread(env.chat_id, to);
    ctx.soon();
  },
  // a coordinator steered, interrupted or stopped a thread: kept for the thread's timeline
  "thread.control"(ctx, env, d) {
    if (ctx.noteControl(env, d)) ctx.soon();
  },
  card(ctx, env, d) {
    if (typeof d.ts !== "string") return rejectFrame(ctx, "card", "ts");
    const r = ctx.rawThreads.get(d.ts);
    if (d.card != null && !isThreadCard(d.card)) return rejectFrame(ctx, "card", "card");
    if (!r) return;
    ctx.threadRecords.write(d.ts, { card: d.card, updated_at: env.ts || r.updated_at });
    ctx.soon();
  },
};
