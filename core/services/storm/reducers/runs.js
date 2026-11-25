// @ts-check
import { rejectFrame } from "../frame-failures.js";
import { number, text } from "../../world/frame-values.js";
import { isRecord } from "../../../platform/util.js";
import { publishStreamRun } from "../act.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const runs = {
  // a sub-agent at work keeps its thread Working after the turn: the threads are rebuilt
  "run.started"(ctx, env, d) {
    if (typeof d.run_id !== "string") return rejectFrame(ctx, "run.started", "run_id");
    if (!env.session_id) return rejectFrame(ctx, "run.started", "session_id");
    const i = isRecord(d.info) ? d.info : {};
    publishStreamRun(ctx, {
      ...ctx.state.runs.get(d.run_id), id: d.run_id, session: env.session_id, parent: text(d.parent_run_id) || null,
      state: text(d.state) || "running", title: text(i.title) || text(i.agent_type) || "Sub-agent", kind: text(i.kind) || "subagent",
      background: !!i.background, depth: number(i.depth) || 1, model: text(i.model) || null, spawn: text(i.spawn_call_id) || null,
      started_at: env.ts, hidden: !!i.hidden, seen: Date.now(), seenSeq: env.seq ?? null,
    });
  },
  "run.state"(ctx, env, d) {
    if (typeof d.run_id !== "string") return rejectFrame(ctx, "run.state", "run_id");
    const r = ctx.state.runs.get(d.run_id);
    if (!r) return;
    publishStreamRun(ctx, {
      ...r, state: text(d.state) || r.state, stopping: !!d.stop_requested_at,
      background: typeof d.background === "boolean" ? d.background : r.background,
      seen: Date.now(), seenSeq: env.seq ?? r.seenSeq ?? null,
    });
  },
  "run.finished"(ctx, env, d) {
    if (typeof d.run_id !== "string") return rejectFrame(ctx, "run.finished", "run_id");
    const r = ctx.state.runs.get(d.run_id);
    const session = r?.session || env.session_id;
    if (!session) return rejectFrame(ctx, "run.finished", "session_id");
    publishStreamRun(ctx, {
      ...(r || { id: d.run_id, session, title: "Sub-agent", kind: "subagent" }),
      state: text(d.state) || "finished", status: text(d.status), summary: text(d.summary) || null, tokens: number(d.tokens) ?? r?.tokens,
      tool_calls: number(d.tool_calls) ?? r?.tool_calls,
      last_tool: text(d.last_tool) ?? r?.last_tool, stopped_by: text(d.stopped_by) || null,
      ended_at: env.ts || new Date().toISOString(), seen: Date.now(),
    });
  },
  runs(ctx, env, d) {
    if (typeof d.session !== "string" || !d.session) return rejectFrame(ctx, "runs", "session");
    ctx.state.liveRuns[d.session] = { running: number(d.running) || 0, waiting: number(d.waiting) || 0,
      tokens: number(d.tokens) || 0, at: Date.now(), seq: env.seq ?? null };
    ctx.soon();
  },
};
