// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Record<string, Reducer>} */
export const runs = {
  // a sub-agent at work keeps its thread Working after the turn: the threads are rebuilt
  "run.started"(ctx, env, d) {
    const i = d.info || {};
    ctx.state.runs.set(d.run_id, { ...(ctx.state.runs.get(d.run_id) || {}), id: d.run_id, session: env.session_id, parent: d.parent_run_id || null, state: d.state || "running", title: i.title || i.agent_type || "Sub-agent", kind: i.kind || "subagent", background: !!i.background, depth: i.depth || 1, model: i.model || null, spawn: i.spawn_call_id || null, started_at: env.ts, hidden: !!i.hidden, seen: Date.now(), seenSeq: env.seq ?? null });
    ctx.soon();
  },
  "run.state"(ctx, env, d) {
    const r = ctx.state.runs.get(d.run_id);
    if (r) { ctx.state.runs.set(d.run_id, { ...r, state: d.state || r.state, stopping: !!d.stop_requested_at, background: d.background ?? r.background, seen: Date.now(), seenSeq: env.seq ?? r.seenSeq ?? null }); ctx.soon(); }
  },
  "run.finished"(ctx, env, d) {
    const r = ctx.state.runs.get(d.run_id) || { id: d.run_id, session: env.session_id, title: "Sub-agent", kind: "subagent" };
    ctx.state.runs.set(d.run_id, { ...r, state: d.state || "finished", status: d.status, summary: d.summary || null, tokens: d.tokens ?? r.tokens, tool_calls: d.tool_calls ?? r.tool_calls, last_tool: d.last_tool ?? r.last_tool, stopped_by: d.stopped_by || null, ended_at: env.ts || new Date().toISOString(), seen: Date.now() });
    ctx.soon();
  },
  runs(ctx, env, d) {
    if (d.session) { ctx.state.liveRuns[d.session] = { running: d.running || 0, waiting: d.waiting || 0, tokens: d.tokens || 0, at: Date.now(), seq: env.seq ?? null }; ctx.soon(); }
  },
};
