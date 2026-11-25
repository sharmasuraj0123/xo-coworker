// @ts-check
import { mergeRows, addReaction, updateMessage } from "../../world/rows.js";
import { COORD } from "../config.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const messages = {
  message(ctx, env, d) {
    const { state } = ctx;
    /** @type {import("../types").MessageRow} */
    const row = { ...d, id: d.id, seq: env.seq ?? d.seq ?? null };
    const project = ctx.projectOf(row.chat_id || env.chat_id);
    if (row.thread_ts) {
      const { list, added } = mergeRows(state.threadMsgs[row.thread_ts] || [], [row]);
      state.threadMsgs[row.thread_ts] = list;
      if (added.length) ctx.soon();
      return;
    }
    if (!project) return;
    const added = ctx.addRows(project, [row]);
    if (!added.length) return;
    const aw = state.awaiting[project];
    const reply = row.author_kind !== "owner";
    const answered = !!(aw && reply && COORD.has(row.author_id));
    if (answered) delete state.awaiting[project];
    if (reply && COORD.has(row.author_id)) delete state.failed[project];
    if (reply) ctx.event({ kind: "message", project, text: String(row.text || "").slice(0, 160), answered, author: row.author_id });
    ctx.emit();
  },
  // an agent's emoji on a message: onto the row wherever we hold it (its thread, or its timeline)
  reaction(ctx, env, d) {
    const { state } = ctx;
    const ts = d.thread_ts || env.thread_ts;
    ctx.noteMessageEdit(ts ? "thread:" + ts : "project:" + ctx.projectOf(env.chat_id), d, env.ts ?? null, true);
    const inThread = ts && addReaction(state.threadMsgs[ts], d, env.ts);
    if (inThread) { state.threadMsgs[ts] = inThread; ctx.soon(); return; }
    const project = ctx.projectOf(env.chat_id);
    const onTimeline = project && addReaction(state.timeline[project], d, env.ts);
    if (onTimeline) { state.timeline[/** @type {string} */ (project)] = onTimeline; ctx.soon(); }
  },
  // a message changed after it was sent (files an agent shared after its turn's last reply), applied where we hold the row
  "message.updated"(ctx, env, d) {
    const { state } = ctx;
    const ts = d.thread_ts || env.thread_ts;
    ctx.noteMessageEdit(ts ? "thread:" + ts : "project:" + ctx.projectOf(d.chat_id || env.chat_id), d, env.ts ?? null, false);
    const inThread = ts && updateMessage(state.threadMsgs[ts], d);
    if (inThread) { state.threadMsgs[ts] = inThread; ctx.soon(); return; }
    const project = ctx.projectOf(d.chat_id || env.chat_id);
    const onTimeline = project && updateMessage(state.timeline[project], d);
    if (onTimeline) { state.timeline[/** @type {string} */ (project)] = onTimeline; ctx.soon(); }
  },
};
