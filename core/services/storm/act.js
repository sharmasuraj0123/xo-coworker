// @ts-check
import { client, worldRead } from "./client.js";
import { heldOf, mainRuntime, sessionBusy } from "../world/sessions.js";
import { commsLine, commsHeader, commsText } from "../comms.js";
import { AWAIT_CAP_MS } from "./config.js";
import { createCommands } from "./commands.js";

/** @import {Ctx, Row} from "./types" */

/** @import {RunRecord} from "../../platform/run-response-types" */
/** @type {WeakMap<Ctx, { revision: number, rows: WeakMap<import("../run-types").StoredRun, number> }>} */
const runOrders = new WeakMap();

/** @param {Ctx} ctx */
function orderFor(ctx) {
  const current = runOrders.get(ctx);
  if (current) return current;
  const order = { revision: 0, rows: new WeakMap() };
  runOrders.set(ctx, order);
  return order;
}

/** @param {Ctx} ctx @param {import("../run-types").StoredRun} record */
export function publishStreamRun(ctx, record) {
  const order = orderFor(ctx);
  ctx.state.runs.set(record.id, record);
  order.rows.set(record, ++order.revision);
  ctx.soon();
}

/** @param {Ctx} ctx */
export function createAct(ctx) {
  const { state, watched, trimmed, scope } = ctx;
  const order = orderFor(ctx);
  return {
    live: true,
    storm: true,
    ...createCommands(ctx),
    /** Read one thread now (a new one the stream hasn't brought yet), so the view can open it. @param {string} chatId @param {string} ts */
    fetchThread: async (chatId, ts) => {
      await ctx.refetchThread(chatId, ts);
      if (scope.signal.aborted) return null;
      ctx.commit(); ctx.emit();
      return state.threads.find((t) => t.id === ts) || null;
    },
    /** @param {string} project */
    loadTimeline: (project) => ctx.loadTimeline(project),
    /** The runtime policy in effect for a project (its own over the Space's), or null before it is read. @param {string} project */
    policyFor: (project) => {
      const chat = ctx.chatIdOf(project);
      return (chat && state.chatPolicy[chat] && state.chatPolicy[chat].effective) || (state.policy && state.policy.effective) || null;
    },
    loadPolicies: ctx.loadPolicies,
    loadChatPolicy: (/** @type {string} */ chat) => ctx.loadChatPolicy(chat),
    loadPaid: ctx.loadPaid,
    /** Read the runtimes again now (Settings › Runtimes asks every 30 s while it is open). */
    loadRuntimes: () => ctx.refreshRuntimes(),
    /** The open conversations: load their timelines once; the stream keeps them current. @param {string[]} projects */
    watch: (projects) => {
      if (scope.signal.aborted) return;
      watched.projects = new Set((projects || []).filter(Boolean));
      for (const p of watched.projects) ctx.loadTimeline(p);
    },
    /** @param {string | null} ts */
    watchThread: (ts) => { if (scope.signal.aborted) return; watched.thread = ts || null; if (ts) ctx.loadThread(ts); },
    /** The thread shown in the panel beside the main chat (null when none): watched as the main one is. @param {string | null} ts */
    watchSideThread: (ts) => {
      if (scope.signal.aborted) return;
      watched.side = ts || null;
      if (ts && ts !== watched.thread) ctx.loadThread(ts);
    },
    /** An open plain chat: its session's turns are never pruned while it is on screen. @param {string | null} sid */
    watchSession: (sid) => { if (!scope.signal.aborted) watched.session = sid || null; },
    /** Were this session's older turns pruned? (then read them again; asking clears it) @param {string} sid */
    takeTrimmed: (sid) => trimmed.delete(sid),
    loadOlder: ctx.loadOlder,
    loadOlderThread: ctx.loadOlderThread,
    /** @param {string} project */
    replying: (project) => {
      const aw = state.awaiting[project];
      if (aw && Date.now() - aw.at > AWAIT_CAP_MS) delete state.awaiting[project];
      const s = ctx.coordinatorOf(ctx.chatIdOf(project));
      // held back by a gate it isn't replying, whatever we sent it: it waits (coordinatorHeld says for what)
      if (ctx.heldOfSession(s)) return false;
      if (state.awaiting[project]) return true;
      return ctx.onTurn(s);
    },
    /** What a chat's coordinator, held back by a gate, waits for, or null. @param {string} project */
    coordinatorHeld: (project) => ctx.heldOfSession(ctx.coordinatorOf(ctx.chatIdOf(project))),
    /** What a session held back by a gate waits for, or null (a plain chat's). @param {string} sessionId */
    sessionHeld: (sessionId) => ctx.heldOfSession(state.sessions[sessionId] || null),
    sentAt: ctx.sentAt,
    /** A session read, taken in the stream's order: sent = sentAt() before the request. @param {Row} s @param {import("./types").Sent} [sent] */
    noteSession: (s, sent) => { if (!scope.signal.aborted && s?.id) { ctx.noteSession(s, sent || ctx.sentAt()); ctx.soon(); } },
    /** Is a session on a turn now (its status, or work seen since it said queued)? @param {string} sessionId */
    onTurn: (sessionId) => ctx.onTurn(state.sessions[sessionId] || null),
    /** Would its pool hold new work for this agent? @param {string | null} agent */
    agentHeld: (agent) => { const p = ctx.agentPool(agent), pool = p && state.pools[p]; return pool && (pool.state === "closed" || pool.state === "paid") ? heldOf({ state: "queued", pool: p }, state.pools) : null; },
    /** What the coordinator is doing now: its running turn's latest block header, for the typing line. @param {string} project */
    doing: (project) => {
      const s = ctx.coordinatorOf(ctx.chatIdOf(project));
      const t = ctx.onTurn(s) && state.turns.running(/** @type {Row} */ (s).id);
      if (!t) return null;
      const bl = state.turns.blocksOf(t);
      const last = bl[bl.length - 1];
      if (!last) return null;
      if (last.type === "activity") { const rows = last.rows || []; const run = rows.filter((/** @type {Row} */ r) => r.status === "running").pop(); const said = run ? commsLine(run) : commsHeader(rows); if (said) return said; }
      return commsText(last.header) || (last.type === "text" ? "Writing" : null);
    },
    /** @param {string} session @param {{ signal?: AbortSignal }} [options] */
    listRuns: async (session, options = {}) => {
      const readOrder = ++order.revision;
      const d = await worldRead(scope.signal, options.signal,
        (signal) => client.runs(session, { tree: "true", depth: 3, limit: 200 }, { signal }));
      scope.signal.throwIfAborted(); options.signal?.throwIfAborted();
      /** @param {RunRecord} run @returns {RunRecord} */
      const publish = (run) => {
        const current = state.runs.get(run.id);
        const children = run.children?.map(publish);
        if (current && (order.rows.get(current) ?? 0) > readOrder) return { ...run, ...current, children };
        const record = {
          ...current, id: run.id, session, parent: run.parent_run_id || null, state: run.state,
          title: run.title || run.agent_type || "Sub-agent", kind: run.kind, background: !!run.background,
          depth: run.depth, spawn: run.spawn_call_id || null, started_at: run.started_at, ended_at: run.ended_at,
          summary: run.summary, tokens: run.tokens, tool_calls: run.tool_calls, last_tool: run.last_tool,
          can_stop: run.can_stop, seen: Date.now(),
        };
        state.runs.set(run.id, record);
        order.rows.set(record, readOrder);
        return children ? { ...run, children } : run;
      };
      const ordered = d.runs.map(publish);
      ctx.soon();
      return { ...d, runs: ordered };
    },
    /** What a session's runtime offers (its feature list), never decided by agent name. @param {string} session @param {string} key */
    feature: (session, key) => {
      const s = state.sessions[session];
      const rt = (state.runtimes || []).find((/** @type {Row} */ r) => r.name === (s && s.agent)) || mainRuntime(state.runtimes);
      const f = rt && rt.features && rt.features.features && rt.features.features[key];
      return !!f && (f.support === "native" || f.support === "emulated");
    },
    /** The id of a session's running turn, or null. @param {string} sessionId */
    turnOf: (sessionId) => { const t = state.turns.running(sessionId); return t ? t.id : null; },
    /** @param {string} sessionId */
    sessionState: (sessionId) => (state.sessions[sessionId] || {}).state || null,
    /** Is a session's agent at work: on a turn, or a sub-agent working on after it? Never while it waits on you. @param {string} sessionId */
    sessionBusy: (sessionId) => {
      const s = state.sessions[sessionId];
      return !!s && sessionBusy(s, ctx.evidenceOf(sessionId));
    },
    /** The agent its newest coordinator session runs on. @param {string | null | undefined} chatId */
    coordinatorAgent: (chatId) => {
      const s = ctx.coordinatorOf(chatId ?? null);
      return (s && s.agent) || null;
    },
    /** The coordinator session of a chat that is working now, if any. @param {string} project */
    coordinatorBusy: (project) => {
      const s = ctx.coordinatorOf(ctx.chatIdOf(project));
      return ctx.onTurn(s) ? /** @type {Row} */ (s).id : null;
    },
    /** A thread's hops, read once when it's opened; the stream keeps them current. @param {string} ts */
    loadHops: (ts) => { ctx.hopsOnce(ts); },
    loadChatHops: ctx.loadChatHops,
    /** The chat id of a project ("workspace" for the Workspace), for its attachments. @param {string} project */
    chatId: (project) => ctx.chatIdOf(project),
    /** Timeline rows named by id that aren't loaded yet; what isn't found stays unknown, never guessed. */
    findRows: ctx.findRows,
    /** A session's recent turns, read from its stored frames. @param {string} sid */
    loadTurns: async (sid) => { await ctx.loadTurns(sid); ctx.emitSoon(); },
    status: ctx.loadStatus,
    chatIdOf: ctx.chatIdOf,
    projectOf: ctx.projectOf,
  };
}
