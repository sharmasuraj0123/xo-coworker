// @ts-check
import { client, clientId as newClientId, worldRead } from "./client.js";
import { mergeRows } from "../world/rows.js";
import { mapLimit } from "./load.js";
import { paidBody } from "../world/paid.js";
import { LOAD_CAP } from "./config.js";
import { ApiError } from "../../platform/http.js";
import { requestFailureMessage } from "../notices/failures.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row @typedef {{ clientId?: string, attachments?: string[] }} SendOpts */

/** @template T @param {unknown} error @param {T} fallback */
function keepLastRead(error, fallback) {
  if (!(error instanceof ApiError && error.status === 404)) requestFailureMessage(error, "Couldn't refresh the saved state.");
  return fallback;
}

/** @param {Ctx} ctx @param {(id: string) => Row | null} threadOf */
function createThreadCommands(ctx, threadOf) {
  const { signal } = ctx.scope;
  /** @param {string} threadId @param {Row | null} t @param {import("./types").Sent} sent */
  const keepAnswer = (threadId, t, sent) => ctx.threadRecords.write(threadId, {
    ...t, ...(t && "busy" in t ? { _readAt: Date.now() } : {}), ...ctx.sessRead(t, sent),
  });
  return {
    /** Resolve or reopen: idempotent, so Undo is the same call the other way. @param {string} threadId */
    resolve: async (threadId, resolved = true) => {
      signal.throwIfAborted();
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const before = { state: r.state, resolved_at: r.resolved_at };
      ctx.threadRecords.write(threadId, {
        state: resolved ? "resolved" : "working", resolved_at: resolved ? new Date().toISOString() : null,
      });
      ctx.soon();
      const sent = ctx.sentAt();
      try {
        const t = await client.patchThread(r.chat_id, threadId, { resolved });
        if (signal.aborted) return t;
        keepAnswer(threadId, t, sent);
        ctx.soon();
        return t;
      } catch (err) {
        if (signal.aborted) throw err;
        ctx.threadRecords.write(threadId, before);
        ctx.soon();
        throw err;
      }
    },
    /** Space's soft delete: the row leaves the lists once Space agrees; a refusal (409 would_lose_work) is thrown for the caller to ask again. @param {string} threadId @param {{ keepBranch?: boolean, confirm?: string | null }} [o] */
    deleteThread: async (threadId, { keepBranch = true, confirm = null } = {}) => {
      signal.throwIfAborted();
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const res = await client.deleteThread(r.chat_id, threadId, { keep_branch: keepBranch, ...(confirm ? { confirm } : {}) });
      if (signal.aborted) return { ...res, row: r };
      ctx.threadRecords.remove(threadId);
      ctx.soon();
      return { ...res, row: r };
    },
    /** @param {string} threadId @param {Row} row */
    restoreThread: async (threadId, row) => {
      signal.throwIfAborted();
      const t = await client.restoreThread(row.chat_id, threadId);
      if (signal.aborted) return t;
      ctx.threadRecords.write(threadId, { ...row, ...(t || {}), _at: Date.now() });
      ctx.soon();
      return t;
    },
    /** Rename (1..120) or label (≤32; null clears). @param {string} threadId @param {Row} change */
    editThread: async (threadId, change) => {
      signal.throwIfAborted();
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const sent = ctx.sentAt();
      const t = await client.patchThread(r.chat_id, threadId, change);
      if (signal.aborted) return t;
      keepAnswer(threadId, t, sent);
      ctx.soon();
      return t;
    },
  };
}

/** The writes: they happen only here, only when the person acts. @param {Ctx} ctx */
export function createCommands(ctx) {
  const { state, rawThreads, emit } = ctx;
  const { signal } = ctx.scope;
  /** @param {string} project @param {string} text @param {{ threadTs?: string, cid?: string, attachments?: string[] }} [o] */
  async function post(project, text, { threadTs, cid, attachments } = {}) {
    signal.throwIfAborted();
    const chat = ctx.chatIdOf(project);
    if (!chat) throw Object.assign(new Error(`No chat for ${project}`), { code: "no_chat" });
    const row = await client.post(chat, { text, threadTs, clientId: cid, attachments });
    if (!signal.aborted) ctx.event({ kind: "you", thread: threadTs || null, project, text });
    return row;
  }
  /** @param {string} id */
  const threadOf = (id) => rawThreads.get(id) || null;

  return {
    /** A reply inside a thread: straight to its agent (a resolved or paused thread goes back to working). @param {string} threadId @param {string} text @param {SendOpts} [o] */
    reply: async (threadId, text, { clientId: cid = newClientId(), attachments } = {}) => {
      const r = threadOf(threadId);
      if (!r) throw new Error("Unknown thread");
      const project = /** @type {string} */ (ctx.projectOf(r.chat_id));
      const row = await post(project, text, { threadTs: threadId, cid, attachments });
      if (signal.aborted) return row || null;
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
      if (signal.aborted) return row || null;
      if (row) {
        ctx.addRows(project, [row]);
        state.awaiting[project] = { id: row.id, at: Date.now() };
        delete state.failed[project];
      }
      emit();
      return row || null;
    },
    ...createThreadCommands(ctx, threadOf),
    decide: () => Promise.reject(new Error("Decide a storm item with decideItem.")),
    /** The only writer of an owner decision; a refusal is never reported as made: the item is read again and the caller told why. @param {string} id @param {Row} body */
    decideItem: async (id, body) => {
      signal.throwIfAborted();
      try {
        const it = await client.decide(id, { ...body, idempotency_key: body.idempotency_key || newClientId() });
        if (!signal.aborted && it && it.state && it.state !== "open") { state.review.delete(id); ctx.soon(); }
        return it;
      } catch (err) {
        if (signal.aborted || !(err instanceof ApiError) || !err.status) throw err;
        const now = await client.reviewItem(id, { signal }).catch((error) => signal.aborted ? null : keepLastRead(error, null));
        if (signal.aborted) throw err;
        const gone = err.code === "already_decided" || err.code === "withdrawn" || err.code === "expired" || err.code === "review_not_found" || !!(now && now.state && now.state !== "open");
        if (gone) state.review.delete(id);
        else if (now) state.review.set(id, { ...(state.review.get(id) || {}), ...now });
        ctx.soon();
        throw Object.assign(err, { item: now }, gone ? { gone: err.code || (now && now.state) || "gone" } : {});
      }
    },
    /** @param {string} scope @param {string} id @param {string | null} value */
    setPaid: async (scope, id, value) => {
      signal.throwIfAborted();
      const r = await client.setPaid(paidBody(scope, id, value));
      await ctx.loadPaid();
      return r;
    },
    /** Replace the Space's runtime policy, or a project's (chat) override; the answer is kept. @param {string | null} chat @param {Row} policy */
    setPolicy: async (chat, policy) => {
      signal.throwIfAborted();
      const saved = await (chat ? client.setChatRuntimePolicy(chat, policy) : client.setRuntimePolicy(policy));
      if (signal.aborted) return saved;
      if (chat) state.chatPolicy[chat] = saved;
      else {
        state.policy = saved;
        for (const c of Object.keys(state.chatPolicy)) {
          const refreshed = await client.chatRuntimePolicy(c, { signal })
            .catch((error) => signal.aborted ? null : keepLastRead(error, state.chatPolicy[c]));
          if (signal.aborted) return saved;
          state.chatPolicy[c] = refreshed;
        }
      }
      emit();
      return saved;
    },
    refresh: async () => {
      const { signal: readSignal } = ctx.reads;
      await ctx.loadChats();
      if (readSignal.aborted) return;
      await mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, ctx.loadThreads, readSignal);
      if (!readSignal.aborted) { ctx.commit(); emit(); }
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    run: (id, options) => worldRead(signal, options?.signal, (readSignal) => client.run(id, { signal: readSignal })),
    /** @param {string} id @param {string | null} [after] @param {{ signal?: AbortSignal }} [options] */
    transcript: (id, after, options) => worldRead(signal, options?.signal,
      (readSignal) => client.transcript(id, { after, limit: 200 }, { signal: readSignal })),
    /** @param {string} id */
    stopRun: (id) => { signal.throwIfAborted(); return client.stopRun(id); },
    /** @param {string} session */
    stopRuns: (session) => { signal.throwIfAborted(); return client.stopRuns(session); },
    /** Stop a session's running turn and its sub-agents now (the 3 s Undo is the caller's). @param {string} sessionId */
    stop: (sessionId) => { signal.throwIfAborted(); return client.abort(sessionId); },
  };
}
