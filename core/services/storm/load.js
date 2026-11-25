// @ts-check
import { client, NEWEST, reportReadFailure } from "./client.js";
import { ApiError } from "../../platform/http.js";
import { once } from "../../platform/pending.js";
import { retryRead, retryableRead } from "./read-policy.js";
import { CHATS_MIN_MS, LOAD_CAP } from "./config.js";

/** @import { Ctx } from "./types" */

/** @import { ChatRecord, Pin } from "../../platform/chat-response-types" */

/** @typedef {ChatRecord & Pin} Chat */

/** @param {Chat | undefined} previous @param {Chat} update */
function mergeChat(previous, update) {
  const row = { ...previous, ...update };
  const pinKeys = (/** @type {const} */ (["agent", "model", "effort"])).filter((key) => key in update);
  if (previous?.pin || update.pin || pinKeys.length) {
    row.pin = { ...previous?.pin, ...update.pin };
    for (const key of pinKeys) row.pin[key] = update[key];
  }
  return row;
}

/** @param {Chat} c @param {import("../world/state-types").WorldState["projects"][number]} [previous] */
function projectOfChat(c, previous) {
  const id = c.kind === "workspace" ? "workspace" : c.project || c.id;
  return {
    ...previous, id, name: c.kind === "workspace" ? "Workspace" : id, kind: c.kind || "project",
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
  /** @type {WeakMap<AbortSignal, Map<string, Chat>>} */
  const updates = new WeakMap();
  /** @param {Chat[]} chats */
  function setProjects(chats) {
    const prev = new Map(state.projects.map((p) => [p.id, p]));
    const prevChat = new Map(chatProject);
    chatProject.clear();
    state.projects = chats.filter((c) => c.kind && !c.retired_at).map((c) => {
      const id = c.kind === "workspace" ? "workspace" : c.project || c.id;
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
      if ("routing" in d) current.routing = d.routing ?? null;
      if (["agent", "model", "effort"].some((key) => key in d)) current.pin = mergeChat({ id: d.id, pin: current.pin }, d).pin;
      ctx.emit();
    }
  };
  ctx.loadChats = async () => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    await once(signal, async () => {
      if (signal.aborted) return;
      /** @type {Map<string, Chat>} */
      const pending = new Map();
      updates.set(signal, pending);
      try {
        const { chats } = await client.chats({ signal });
        if (signal.aborted) return;
        const before = new Set(state.projects.map((p) => p.chatId));
        /** @type {Chat[]} */
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
        if (!retryableRead(err) || !ctx.scheduleRecover()) reportReadFailure(err, signal);
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
    let after = 0;
    for (let i = 0; i < 10; i++) {
      const sent = ctx.sentAt();
      const d = await client.sessions({ after_seq: after, limit: 500 }, { signal });
      if (signal.aborted) return;
      for (const s of d.sessions || []) ctx.noteSession(s, sent);
      if (!d.next_after_seq) break;
      after = d.next_after_seq;
    }
  }
  /** @param {AbortSignal} signal */
  async function loadReview(signal) {
    let after = null;
    const unseen = new Map(state.review);
    for (let i = 0; i < 10; i++) {
      const d = await client.review({ state: "open", limit: 500, ...(after ? { after_seq: after } : {}) }, { signal });
      if (signal.aborted) return;
      for (const it of d.items || []) {
        if (state.review.get(it.id) === unseen.get(it.id)) state.review.set(it.id, it);
        unseen.delete(it.id);
      }
      if (!d.next_after_seq) {
        for (const [id, previous] of unseen) if (state.review.get(id) === previous) state.review.delete(id);
        break;
      }
      after = d.next_after_seq;
    }
  }
  /** Read the project copies used for the "Routed to …" receipts. @param {AbortSignal} signal */
  async function loadRouted(signal) {
    const ws = ctx.chatIdOf("workspace");
    if (!ws) return;
    const { hops } = await client.hops(ws, { before_seq: NEWEST, limit: 500 }, { signal });
    if (signal.aborted) return;
    const history = hops || [];
    const projects = history.filter((h) => h.kind === "forward").map((h) => ctx.projectOf(h.chat_id));
    const targets = new Set(projects.filter((p) => p != null));
    targets.delete("workspace");
    await mapLimit(targets, LOAD_CAP, ctx.loadTimeline, signal);
  }
  /** Everything, from the server. Returns once the world can render. */
  ctx.loadAll = async () => {
    const { signal } = ctx.reads;
    await ctx.loadChats();
    if (signal.aborted || !state.projects.length) return;
    await Promise.all([
      mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, ctx.loadThreads, signal),
      ...[loadSessions, loadReview, loadRouted].map((read) => retryRead(ctx.reads, read)),
      ctx.loadRuntimes(), ctx.loadSpacePolicy(),
    ]);
  };
}
