// @ts-check
import { invalidField, rejectFrame } from "../frame-failures.js";
import { mergeRows, addReaction, updateMessage } from "../../world/rows.js";
import { isMessage } from "../../../platform/chat-responses.js";
import { text } from "../../world/frame-values.js";
import { COORD } from "../config.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const messages = {
  message(ctx, env, d) {
    if (!isMessage(d)) return rejectFrame(ctx, "message", invalidField(d, { id: "" }, isMessage));
    const { state } = ctx;
    /** @type {import("../types").MessageRow} */
    const row = { ...d, id: d.id, seq: env.seq ?? d.seq ?? null };
    const project = ctx.projectOf(row.chat_id || env.chat_id);
    if (row.thread_ts) {
      const message = ctx.applyPendingMessageEdits("thread:" + row.thread_ts, row);
      const { list, added } = mergeRows(state.threadMsgs[row.thread_ts] || [], [message]);
      state.threadMsgs[row.thread_ts] = list;
      if (added.length) ctx.soon();
      return;
    }
    if (!project) return;
    const added = ctx.addRows(project, [row]);
    if (!added.length) return;
    const aw = state.awaiting[project];
    const reply = row.author_kind !== "owner";
    const coordinatorReply = reply && !!row.author_id && COORD.has(row.author_id);
    const answered = !!aw && coordinatorReply;
    if (answered) delete state.awaiting[project];
    if (coordinatorReply) delete state.failed[project];
    if (reply) ctx.event({ kind: "message", project, text: String(row.text || "").slice(0, 160), answered, author: row.author_id });
    ctx.emit();
  },
  // an agent's emoji on a message: onto the row wherever we hold it (its thread, or its timeline)
  reaction(ctx, env, d) {
    if (typeof d.message_id !== "string" || typeof d.emoji !== "string") return rejectFrame(ctx, "reaction", "message_id or emoji");
    const { state } = ctx;
    const ts = text(d.thread_ts) || env.thread_ts;
    const inThread = ts && addReaction(state.threadMsgs[ts], d, env.ts);
    if (inThread) { state.threadMsgs[ts] = inThread; ctx.soon(); return; }
    const project = ctx.projectOf(env.chat_id);
    const onTimeline = project && addReaction(state.timeline[project], d, env.ts);
    if (onTimeline && project) { state.timeline[project] = onTimeline; ctx.soon(); return; }
    ctx.noteMessageEdit(ts ? "thread:" + ts : "project:" + project, d, env.ts ?? null, true);
  },
  // a message changed after it was sent (files an agent shared after its turn's last reply), applied where we hold the row
  "message.updated"(ctx, env, d) {
    if (typeof d.id !== "string") return rejectFrame(ctx, "message.updated", "id");
    const { state } = ctx;
    const ts = text(d.thread_ts) || env.thread_ts;
    const inThread = ts && updateMessage(state.threadMsgs[ts], d);
    if (inThread) { state.threadMsgs[ts] = inThread; ctx.soon(); return; }
    const project = ctx.projectOf(text(d.chat_id) || env.chat_id);
    const onTimeline = project && updateMessage(state.timeline[project], d);
    if (onTimeline && project) { state.timeline[project] = onTimeline; ctx.soon(); return; }
    ctx.noteMessageEdit(ts ? "thread:" + ts : "project:" + project, d, env.ts ?? null, false);
  },
};
