// @ts-check
import { client, NEWEST } from "./client.js";
import { CHATS_MIN_MS, LOAD_CAP } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** Run `fn` over `items`, at most `cap` at a time. @template T @param {Iterable<T>} items @param {number} cap @param {(x: T) => Promise<unknown>} fn */
export async function mapLimit(items, cap, fn) {
  const list = [...items];
  const run = async () => { while (list.length) await fn(/** @type {T} */ (list.shift())); };
  await Promise.all(Array.from({ length: Math.min(cap, list.length) }, run));
}

/** Reading the Space with GETs: chats, threads, sessions and review items. @param {Ctx} ctx */
export function installLoad(ctx) {
  const { state, chatProject, rawThreads } = ctx;
  let chatsAt = 0;
  /** @type {Promise<void> | null} */
  let chatsBusy = null;

  ctx.setProjects = (chats) => {
    const prev = new Map(state.projects.map((p) => [p.id, p]));
    chatProject.clear();
    state.projects = chats.filter((c) => !c.retired_at).map((c) => {
      const id = c.kind === "workspace" ? "workspace" : c.project;
      chatProject.set(c.id, id);
      return { ...(prev.get(id) || {}), id, name: c.kind === "workspace" ? "Workspace" : c.project, kind: c.kind, chatId: c.id, pid: c.project_pid || null, routing: c.routing || null, pin: c.pin || null, hasChat: true };
    });
    for (const c of chats) if (c.retired_at) chatProject.set(c.id, c.project || null);
  };
  ctx.loadChats = async () => {
    if (chatsBusy) return chatsBusy;
    chatsBusy = (async () => {
      try {
        const { chats } = await client.chats();
        const before = new Set(state.projects.map((p) => p.chatId));
        ctx.setProjects(chats || []);
        chatsAt = Date.now();
        state.error = null; state.errorCode = null;
        // a project chat we haven't seen: its threads (there may be none yet)
        const fresh = state.projects.filter((p) => p.kind === "project" && !before.has(p.chatId));
        if (state.loaded) await mapLimit(fresh, LOAD_CAP, ctx.loadThreads);
      } catch (/** @type {any} */ err) {
        state.error = err.message;
        state.errorCode = err.code;
        ctx.scheduleRecover();
      }
      ctx.soon();
    })();
    try { return await chatsBusy; } finally { chatsBusy = null; }
  };
  ctx.maybeChats = () => { if (Date.now() - chatsAt > CHATS_MIN_MS) ctx.loadChats(); };
  ctx.loadThreads = async (p) => {
    const asked = Date.now(), sent = ctx.sentAt();
    try {
      const { threads } = await client.threads(p.chatId);
      const seen = new Set();
      for (const r of threads || []) { seen.add(r.ts); rawThreads.set(r.ts, { ...(rawThreads.get(r.ts) || {}), ...r, _at: Date.now(), _readAt: Date.now(), ...ctx.sessRead(r, sent) }); }
      // gone from the listing, unless a frame made it after the listing was read
      for (const [ts, r] of rawThreads) if (r.chat_id === p.chatId && !seen.has(ts) && (r._at || 0) < asked) rawThreads.delete(ts);
    } catch { /* keep the last good threads for this project */ }
  };
  ctx.loadActive = async () => {
    try {
      const { turns } = await client.active();
      for (const x of turns || []) if (x.turn_id && x.session_id && !state.turns.get(x.turn_id)) state.turns.apply({ type: "turn.started", envelope: { type: "turn.started", turn_id: x.turn_id, session_id: x.session_id, chat_id: x.chat_id || null, thread_ts: x.thread_ts || null, ts: x.started_at || null, data: { origin: x.origin || null } } });
    } catch { /* a thread's own read fills it in */ }
  };
  async function loadSessions() {
    // the coordinators (for "is replying") and the thread sessions' live state
    try {
      let after = 0;
      for (let i = 0; i < 10; i++) {
        const sent = ctx.sentAt();
        const d = await client.sessions({ after_seq: after, limit: 500 });
        for (const s of d.sessions || []) ctx.noteSession(s, sent);
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
    } catch { /* the stream's session frames fill in */ }
  }
  async function loadReview() {
    try {
      let after = null;
      const seen = new Set();
      for (let i = 0; i < 10; i++) {
        const d = await client.review({ state: "open", limit: 500, ...(after ? { after_seq: after } : {}) });
        for (const it of d.items || []) { seen.add(it.id); state.review.set(it.id, it); }
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      for (const id of [...state.review.keys()]) if (!seen.has(id)) state.review.delete(id);
    } catch { /* the review queue reads it again */ }
  }
  // the "Routed to …" receipts come from the projects' copies; at boot, the projects the workspace forwarded to have their newest page read
  async function loadRouted() {
    const ws = ctx.chatIdOf("workspace");
    if (!ws) return;
    try {
      const { hops } = await client.hops(ws, { before_seq: NEWEST, limit: 500 });
      const targets = [...new Set((hops || []).filter((/** @type {Row} */ h) => h.kind === "forward").map((/** @type {Row} */ h) => ctx.projectOf(h.chat_id)).filter((/** @type {any} */ p) => p && p !== "workspace"))];
      await mapLimit(targets, LOAD_CAP, (/** @type {string} */ p) => ctx.loadTimeline(p));
    } catch { /* receipts come back with new copies */ }
  }
  /** Everything, from the server. Returns once the world can render. */
  ctx.loadAll = async () => {
    await ctx.loadChats();
    if (!state.projects.length) return;
    await Promise.all([
      mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, ctx.loadThreads),
      loadSessions(), loadReview(), loadRouted(), ctx.loadRuntimes(), ctx.loadSpacePolicy(),
    ]);
  };

  /** @type {Set<string>} */
  const refetchBusy = new Set();
  ctx.refetchThread = async (chatId, ts) => {
    if (!chatId || refetchBusy.has(ts)) return;
    refetchBusy.add(ts);
    const sent = ctx.sentAt();
    try { const x = await client.thread(chatId, ts); rawThreads.set(ts, { ...x, _readAt: Date.now(), ...ctx.sessRead(x, sent) }); ctx.soon(); } catch { /* the next full frame fills it */ }
    refetchBusy.delete(ts);
  };
  /** @type {Set<string>} */
  const sessionAsked = new Set();
  ctx.fillSession = async (chatId, ts) => {
    if (!chatId || sessionAsked.has(ts)) return;
    sessionAsked.add(ts);
    const sent = ctx.sentAt();
    try {
      const x = await client.thread(chatId, ts), r = rawThreads.get(ts);
      if (r && x && !r.session) { rawThreads.set(ts, { ...r, session: x.session || null, pin: x.pin || r.pin || {}, ...ctx.sessRead(x, sent) }); ctx.soon(); }
    } catch { sessionAsked.delete(ts); }
  };
}
