// @ts-check
import { client } from "./client.js";
import { heldOf, mainRuntime, sessionBusy } from "../world/sessions.js";
import { commsLine, commsHeader, commsText } from "../../../js/comms.js";
import { AWAIT_CAP_MS } from "./config.js";
import { createCommands } from "./commands.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** What the views call as world.act: the writes, what to watch and read, and what a session or chat is doing. @param {Ctx} ctx */
export function createAct(ctx) {
  const { state, watched, trimmed } = ctx;
  return {
    live: true,
    storm: true,
    ...createCommands(ctx),
    /** Read one thread now (a new one the stream hasn't brought yet), so the view can open it. @param {string} chatId @param {string} ts */
    fetchThread: async (chatId, ts) => { await ctx.refetchThread(chatId, ts); ctx.commit(); ctx.emit(); return state.threads.find((t) => t.id === ts) || null; },
    /** @param {string} project */
    loadTimeline: (project) => ctx.loadTimeline(project),
    /** The runtime policy in effect for a project (its own over the Space's), or null before it is read. @param {string} project */
    policyFor: (project) => {
      const chat = ctx.chatIdOf(project);
      return (chat && state.chatPolicy[chat] && state.chatPolicy[chat].effective) || (state.policy && state.policy.effective) || null;
    },
    loadPolicies: ctx.loadPolicies,
    loadPaid: ctx.loadPaid,
    /** Read the runtimes again now (Settings › Runtimes asks every 30 s while it is open). */
    loadRuntimes: () => ctx.refreshRuntimes(),
    /** The open conversations: load their timelines once; the stream keeps them current. @param {string[]} projects */
    watch: (projects) => { watched.projects = new Set((projects || []).filter(Boolean)); for (const p of watched.projects) ctx.loadTimeline(p); },
    /** @param {string | null} ts */
    watchThread: (ts) => { watched.thread = ts || null; if (ts) ctx.loadThread(ts); },
    /** The thread shown in the panel beside the main chat (null when none): watched as the main one is. @param {string | null} ts */
    watchSideThread: (ts) => { watched.side = ts || null; if (ts && ts !== watched.thread) ctx.loadThread(ts); },
    /** An open plain chat: its session's turns are never pruned while it is on screen. @param {string | null} sid */
    watchSession: (sid) => { watched.session = sid || null; },
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
    /** Where the stream stands now, for a read about to be sent. */
    sentAt: ctx.sentAt,
    /** A session read, taken in the stream's order: sent = sentAt() before the request. @param {Row} s @param {import("./types").Sent} [sent] */
    noteSession: (s, sent) => { if (s && s.id) { ctx.noteSession(s, sent || ctx.sentAt()); ctx.soon(); } },
    /** Is a session on a turn now (its status, or work seen since it said queued)? @param {string} sessionId */
    onTurn: (sessionId) => ctx.onTurn(state.sessions[sessionId] || null),
    /** Would new work for this agent be held back now (its pool closed or held for paid usage)? @param {string} agent */
    agentHeld: (agent) => { const p = ctx.agentPool(agent), pool = p && state.pools[p]; return pool && (pool.state === "closed" || pool.state === "paid") ? heldOf({ state: "queued", pool: p }, state.pools) : null; },
    /** What the coordinator is doing now: its running turn's latest block header, for the typing line. @param {string} project */
    doing: (project) => {
      const s = ctx.coordinatorOf(ctx.chatIdOf(project));
      const t = ctx.onTurn(s) && state.turns.running(/** @type {Row} */ (s).id);
      if (!t) return null;
      const bl = state.turns.blocksOf(t);
      const last = bl[bl.length - 1];
      if (!last) return null;
      // a step that reaches another agent is said as what it is, not as the tool's name
      if (last.type === "activity") { const rows = last.rows || []; const run = rows.filter((/** @type {Row} */ r) => r.status === "running").pop(); const said = run ? commsLine(run) : commsHeader(rows); if (said) return said; }
      return commsText(last.header) || (last.type === "text" ? "Writing" : null);
    },
    /** A session's runs as a tree, with counts; a read's runs carry no stream seq. @param {string} session */
    listRuns: async (session) => {
      const d = await client.runs(session, { tree: "true", depth: 3, limit: 200 });
      /** @param {Row[]} nodes */
      const walk = (nodes) => { for (const n of nodes || []) { state.runs.set(n.id, { ...(state.runs.get(n.id) || {}), id: n.id, session, parent: n.parent_run_id || null, state: n.state, title: n.title || n.agent_type || "Sub-agent", kind: n.kind, background: !!n.background, depth: n.depth, spawn: n.spawn_call_id || null, started_at: n.started_at, ended_at: n.ended_at, summary: n.summary, tokens: n.tokens, tool_calls: n.tool_calls, last_tool: n.last_tool, can_stop: n.can_stop, seen: Date.now() }); walk(n.children); } };
      walk(d.runs);
      ctx.soon();
      return d;
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
    /** The agent a chat's coordinator runs on (its newest live session), if known. @param {string} chatId */
    coordinatorAgent: (chatId) => {
      const s = ctx.coordinatorOf(chatId);
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
