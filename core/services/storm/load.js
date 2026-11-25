// @ts-check
import { client, NEWEST, reportReadFailure } from "./client.js";
import { ApiError } from "../../platform/http.js";
import { once } from "../../platform/pending.js";
import { CHATS_MIN_MS, LOAD_CAP } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** @param {Row | undefined} previous @param {Row} update */
function mergeChat(previous, update) {
  const row = { ...previous, ...update };
  const pinKeys = ["agent", "model", "effort"].filter((key) => key in update);
  if (previous?.pin || update.pin || pinKeys.length) {
    row.pin = { ...previous?.pin, ...update.pin };
    for (const key of pinKeys) row.pin[key] = update[key];
  }
  return row;
}

/** @param {Row} c @param {import("../world/state-types").WorldState["projects"][number]} [previous] */
function projectOfChat(c, previous) {
  const id = c.kind === "workspace" ? "workspace" : c.project;
  return {
    ...previous, id, name: c.kind === "workspace" ? "Workspace" : c.project, kind: c.kind,
    chatId: c.id, pid: c.project_pid || null, routing: c.routing || null, pin: c.pin || null, hasChat: true,
  };
}

/** @template T @param {Iterable<T>} items @param {number} cap @param {(x: T) => Promise<unknown>} fn @param {AbortSignal} [signal] */
export async function mapLimit(items, cap, fn, signal) {
  const list = Array.from(items);
  const pending = list.values();
  const run = async () => {
    for (const value of pending) {
      if (signal?.aborted) return;
      await fn(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(cap, list.length) }, run));
}

/** Reading the Space with GETs: chats, threads, sessions and review items. @param {Ctx} ctx */
export function installLoad(ctx) {
  const { state, chatProject } = ctx;
  let chatsAt = 0;
  /** @type {WeakMap<AbortSignal, Map<string, Row>>} */
  const updates = new WeakMap();
  /** @param {Row[]} chats */
  function setProjects(chats) {
    const prev = new Map(state.projects.map((p) => [p.id, p]));
    const prevChat = new Map(chatProject);
    chatProject.clear();
    state.projects = chats.filter((c) => c.kind && !c.retired_at).map((c) => {
      const id = c.kind === "workspace" ? "workspace" : c.project;
      chatProject.set(c.id, id);
      return projectOfChat(c, prev.get(id));
    });
    for (const c of chats) if (c.retired_at) chatProject.set(c.id, c.project || prevChat.get(c.id) || null);
  }
  ctx.noteChat = (d) => {
    if (!d.id) return;
    const pending = updates.get(ctx.reads.signal);
    pending?.set(d.id, mergeChat(pending.get(d.id), d));
    const current = state.projects.find((p) => p.chatId === d.id);
    if (d.retired_at) {
      chatProject.set(d.id, d.project || current?.id || chatProject.get(d.id) || null);
      state.projects = state.projects.filter((p) => p !== current);
      ctx.soon();
    } else if (!current && d.kind && !chatProject.has(d.id)) {
      const project = projectOfChat({ pin: { agent: null, model: null, effort: null }, ...d });
      chatProject.set(d.id, project.id);
      state.projects.push(project);
      ctx.soon();
    } else if (current) {
      if ("routing" in d) current.routing = d.routing;
      if (["agent", "model", "effort"].some((key) => key in d)) current.pin = mergeChat(current, d).pin;
      ctx.emit();
    }
  };
  ctx.loadChats = async () => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    await once(signal, async () => {
      if (signal.aborted) return;
      /** @type {Map<string, Row>} */
      const pending = new Map();
      updates.set(signal, pending);
      try {
        const { chats } = await client.chats({ signal });
        if (signal.aborted) return;
        const before = new Set(state.projects.map((p) => p.chatId));
        /** @type {Row[]} */
        const listed = chats || [];
        const current = new Map(listed.map((c) => [c.id, c]));
        for (const [id, update] of pending) current.set(id, mergeChat(current.get(id), update));
        updates.delete(signal);
        setProjects([...current.values()]);
        chatsAt = Date.now();
        state.error = null; state.errorCode = null;
        const fresh = state.projects.filter((p) => p.kind === "project" && !before.has(p.chatId));
        if (state.loaded) await mapLimit(fresh, LOAD_CAP, ctx.loadThreads, signal);
      } catch (err) {
        if (signal.aborted) return;
        state.error = err instanceof Error ? err.message : String(err);
        state.errorCode = err instanceof ApiError ? err.code : null;
        reportReadFailure(err, signal);
        ctx.scheduleRecover();
      } finally { updates.delete(signal); }
      if (!signal.aborted) ctx.soon();
    });
  };
  ctx.maybeChats = () => { if (Date.now() - chatsAt > CHATS_MIN_MS) ctx.loadChats(); };
  ctx.loadActive = async () => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    try {
      const { turns } = await client.active({ signal });
      if (signal.aborted) return;
      for (const x of turns || []) if (x.turn_id && x.session_id && !state.turns.get(x.turn_id)) state.turns.apply({ type: "turn.started", envelope: { type: "turn.started", turn_id: x.turn_id, session_id: x.session_id, chat_id: x.chat_id || null, thread_ts: x.thread_ts || null, ts: x.started_at || null, data: { origin: x.origin || null } } });
    } catch (error) { reportReadFailure(error, signal, true); }
  };
  /** @param {AbortSignal} signal */
  async function loadSessions(signal) {
    // the coordinators (for "is replying") and the thread sessions' live state
    try {
      let after = 0;
      for (let i = 0; i < 10; i++) {
        const sent = ctx.sentAt();
        const d = await client.sessions({ after_seq: after, limit: 500 }, { signal });
        if (signal.aborted) return;
        for (const s of d.sessions || []) ctx.noteSession(s, sent);
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
    } catch (error) { reportReadFailure(error, signal, true); }
  }
  /** @param {AbortSignal} signal */
  async function loadReview(signal) {
    try {
      let after = null;
      const seen = new Set();
      for (let i = 0; i < 10; i++) {
        const d = await client.review({ state: "open", limit: 500, ...(after ? { after_seq: after } : {}) }, { signal });
        if (signal.aborted) return;
        for (const it of d.items || []) { seen.add(it.id); state.review.set(it.id, it); }
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      for (const id of [...state.review.keys()]) if (!seen.has(id)) state.review.delete(id);
    } catch (error) { reportReadFailure(error, signal, true); }
  }
  /** Read the project copies used for the "Routed to …" receipts. @param {AbortSignal} signal */
  async function loadRouted(signal) {
    const ws = ctx.chatIdOf("workspace");
    if (!ws) return;
    try {
      const { hops } = await client.hops(ws, { before_seq: NEWEST, limit: 500 }, { signal });
      if (signal.aborted) return;
      /** @type {Row[]} */
      const history = hops || [];
      const projects = history.filter((h) => h.kind === "forward").map((h) => ctx.projectOf(h.chat_id));
      const targets = new Set(projects.filter((p) => p != null));
      targets.delete("workspace");
      await mapLimit(targets, LOAD_CAP, ctx.loadTimeline, signal);
    } catch (error) { reportReadFailure(error, signal, true); }
  }
  /** Everything, from the server. Returns once the world can render. */
  ctx.loadAll = async () => {
    const { signal } = ctx.reads;
    await ctx.loadChats();
    if (signal.aborted || !state.projects.length) return;
    await Promise.all([
      mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, ctx.loadThreads, signal),
      loadSessions(signal), loadReview(signal), loadRouted(signal), ctx.loadRuntimes(), ctx.loadSpacePolicy(),
    ]);
  };
}
