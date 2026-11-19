// @ts-check
import { client, clientId as newClientId } from "./client.js";
import { mergeRows, mapLimit } from "../../../js/timeline.js";
import { paidBody } from "../../../js/paid.js";
import { LOAD_CAP } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row @typedef {{ clientId?: string, attachments?: string[] }} SendOpts */

/** The writes: they happen only here, only when the person acts. @param {Ctx} ctx */
export function createCommands(ctx) {
  const { state, rawThreads, emit } = ctx;
  /** @param {string} project @param {string} text @param {{ threadTs?: string, cid?: string, attachments?: string[] }} [o] */
  async function post(project, text, { threadTs, cid, attachments } = {}) {
    const chat = ctx.chatIdOf(project);
    if (!chat) throw Object.assign(new Error(`No chat for ${project}`), { code: "no_chat" });
    const row = await client.post(chat, { text, threadTs, clientId: cid, attachments });
    ctx.event({ kind: "you", thread: threadTs || null, project, text });
    return row;
  }
  /** @param {string} id */
  const threadOf = (id) => rawThreads.get(id) || null;
  /** @param {string} threadId @param {Row | null} t @param {import("./types").Sent} sent */
  const keepAnswer = (threadId, t, sent) => rawThreads.set(threadId, { ...rawThreads.get(threadId), ...t, ...(t && "busy" in t ? { _readAt: Date.now() } : {}), ...ctx.sessRead(t, sent) });

  return {
    /** A reply inside a thread: straight to its agent (a resolved or paused thread goes back to working). @param {string} threadId @param {string} text @param {SendOpts} [o] */
    reply: async (threadId, text, { clientId: cid = newClientId(), attachments } = {}) => {
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const project = /** @type {string} */ (ctx.projectOf(r.chat_id));
      const row = await post(project, text, { threadTs: threadId, cid, attachments });
      if (row) {
        const { list } = mergeRows(state.threadMsgs[threadId] || [], [row]);
        state.threadMsgs[threadId] = list;
      }
      ctx.soon();
      return row || null;
    },
    /** A message to a timeline (the Workspace or a project): its router decides what happens. @param {string | null} projectId @param {string} text @param {SendOpts} [o] */
    ask: async (projectId, text, { clientId: cid = newClientId(), attachments } = {}) => {
      const project = projectId || "workspace";
      const row = await post(project, text, { cid, attachments });
      if (row) {
        ctx.addRows(project, [row]);
        state.awaiting[project] = { id: row.id, at: Date.now() };
        delete state.failed[project];
      }
      emit();
      return row || null;
    },
    /** Resolve or reopen: idempotent, so Undo is the same call the other way. @param {string} threadId */
    resolve: async (threadId, resolved = true) => {
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const before = { state: r.state, resolved_at: r.resolved_at };
      rawThreads.set(threadId, { ...r, state: resolved ? "resolved" : "working", resolved_at: resolved ? new Date().toISOString() : null });
      ctx.soon();
      const sent = ctx.sentAt();
      try {
        const t = await client.patchThread(r.chat_id, threadId, { resolved });
        keepAnswer(threadId, t, sent);
        ctx.soon();
        return t;
      } catch (err) {
        rawThreads.set(threadId, { ...rawThreads.get(threadId), ...before });
        ctx.soon();
        throw err;
      }
    },
    /** Space's soft delete: the row leaves the lists once Space agrees; a refusal (409 would_lose_work) is thrown for the caller to ask again. @param {string} threadId @param {{ keepBranch?: boolean, confirm?: string | null }} [o] */
    deleteThread: async (threadId, { keepBranch = true, confirm = null } = {}) => {
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const res = await client.deleteThread(r.chat_id, threadId, { keep_branch: keepBranch, ...(confirm ? { confirm } : {}) });
      rawThreads.delete(threadId);
      ctx.soon();
      return { ...res, row: r };
    },
    /** @param {string} threadId @param {Row} row */
    restoreThread: async (threadId, row) => {
      const t = await client.restoreThread(row.chat_id, threadId);
      rawThreads.set(threadId, { ...row, ...(t || {}), _at: Date.now() });
      ctx.soon();
      return t;
    },
    /** Rename (1..120) or label (≤32; null clears). @param {string} threadId @param {Row} change */
    editThread: async (threadId, change) => {
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const sent = ctx.sentAt();
      const t = await client.patchThread(r.chat_id, threadId, change);
      keepAnswer(threadId, t, sent);
      ctx.soon();
      return t;
    },
    decide: () => Promise.reject(new Error("Decide a storm item with decideItem.")),
    /** The only writer of an owner decision; a refusal is never reported as made: the item is read again and the caller told why. @param {string} id @param {Row} body */
    decideItem: async (id, body) => {
      try {
        const it = await client.decide(id, { ...body, idempotency_key: body.idempotency_key || newClientId() });
        if (it && it.state && it.state !== "open") { state.review.delete(id); ctx.soon(); }
        return it;
      } catch (/** @type {any} */ err) {
        if (!err.status) throw err; // never reached XO: the item is as it was
        let now = null;
        try { now = await client.reviewItem(id); } catch { /* gone, or unreadable: the code says enough */ }
        const gone = err.code === "already_decided" || err.code === "withdrawn" || err.code === "expired" || err.code === "review_not_found" || !!(now && now.state && now.state !== "open");
        if (gone) state.review.delete(id);
        else if (now) state.review.set(id, { ...(state.review.get(id) || {}), ...now });
        ctx.soon();
        err.item = now;
        if (gone) err.gone = err.code || (now && now.state) || "gone";
        throw err;
      }
    },
    /** The Space's paid-usage mode (scope "space"), or an account's (scope "pool"; value null follows the Space). @param {string} scope @param {string} id @param {any} value */
    setPaid: async (scope, id, value) => {
      const r = await client.setPaid(paidBody(scope, id, value));
      await ctx.loadPaid();
      return r;
    },
    /** Replace the Space's runtime policy, or a project's (chat) override; the answer is kept. @param {string | null} chat @param {Row} policy */
    setPolicy: async (chat, policy) => {
      if (!chat) { state.policy = await client.setRuntimePolicy(policy); for (const c of Object.keys(state.chatPolicy)) { try { state.chatPolicy[c] = await client.chatRuntimePolicy(c); } catch { /* keep */ } } }
      else state.chatPolicy[chat] = await client.setChatRuntimePolicy(chat, policy);
      emit();
      return chat ? state.chatPolicy[chat] : state.policy;
    },
    refresh: async () => { await ctx.loadChats(); await mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, ctx.loadThreads); ctx.commit(); emit(); },
    /** @param {string} id */
    run: (id) => client.run(id),
    /** @param {string} id @param {any} [after] */
    transcript: (id, after) => client.transcript(id, after ? { after, limit: 200 } : { limit: 200 }),
    /** @param {string} id */
    stopRun: (id) => client.stopRun(id),
    /** @param {string} session */
    stopRuns: (session) => client.stopRuns(session),
    /** Stop a session's running turn and its sub-agents now (the 3 s Undo is the caller's). @param {string} sessionId */
    stop: (sessionId) => client.abort(sessionId),
  };
}
