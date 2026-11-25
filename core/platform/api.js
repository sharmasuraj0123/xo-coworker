// @ts-check

import { request, blob, signedUrl, socketUrl, text, upload, urlOf, exchange, coderHeaders, ApiError } from "./http.js";
import { readJsonEvents } from "./sse.js";
import { engineStatus } from "./response.js";
import { projectApi } from "./project-api.js";
import { scheduleApi } from "./schedule-response.js";
export { coderHeaders, ApiError, request, missingRoute, clientId } from "./http.js";

const enc = encodeURIComponent;
/** @param {string} chat @param {string} id */
const attPath = (chat, id) => `/chat/chats/${enc(chat)}/attachments/${enc(id)}`;

/** The URL an <img> or <iframe> loads an attachment from (they can't send headers). @param {string} chat @param {string} id */
export const attachmentUrl = (chat, id) => signedUrl(attPath(chat, id));

/** The ws(s):// URL of a shell's socket. The attach ticket never goes in the URL: it is the first message. @param {string} id */
export const terminalSocketUrl = (id) => socketUrl(`/terminal/sessions/${enc(id)}/ws`);

/** An attachment's text, for the viewer (the server always sends text as text/plain). @param {string} chat @param {string} id @param {{ signal?: AbortSignal }} [opts] */
export const attachmentText = (chat, id, { signal } = {}) => text(attPath(chat, id), { signal });

/** Upload one file's raw bytes to a chat: {promise → {id, name, type, bytes}, abort()}. @param {string} chat @param {Blob} blob @param {string} name @param {{ onProgress?: (sent: number, total: number) => void }} [opts] */
export const uploadAttachment = (chat, blob, name, { onProgress } = {}) => {
  const { promise, abort } = upload(`/chat/chats/${enc(chat)}/attachments?name=${enc(name)}`, blob, { onProgress });
  return { promise: /** @type {Promise<{id: string, name?: string, type: string, bytes: number}>} */ (promise), abort };
};

/** @param {string} path @param {Record<string, unknown>} [query] @param {AbortSignal} [signal] */
const get = (path, query, signal) => request(path, { query, signal });
/** @param {string} method @param {string} path @param {unknown} [body] @param {Record<string, unknown>} [query] */
const send = (method, path, body, query) => request(path, { method, body, query });

/** The largest seq: "the newest page" is the page just before it. */
export const NEWEST = 9007199254740991;

export const chatActivityApi = {
  /** @param {AbortSignal} [signal] */
  chats: (signal) => request("/chat/chats", { signal }),
  /** @param {string} chat @param {AbortSignal} [signal] */
  markSeen: (chat, signal) => request(`/chat/chats/${enc(chat)}/seen`, { method: "PUT", body: {}, signal }),
  /** @param {string | null} [chat] @param {AbortSignal} [signal] */
  worktrees: (chat, signal) => request("/chat/worktrees", { query: chat ? { chat } : undefined, signal }),
  /** @param {string} chat @param {string} thread @param {string | null} [confirm] @param {AbortSignal} [signal] */
  removeWorktree: (chat, thread, confirm, signal) => request(`/chat/worktrees/${enc(chat)}/${enc(thread)}`, {
    method: "DELETE", query: confirm ? { confirm } : undefined, signal,
  }),
};

export const ruleApi = {
  /** @param {Record<string, unknown>} [query] @param {AbortSignal} [signal] */
  rules: (query, signal) => request("/chat/rules", { query, signal }),
  /** @param {string} id @param {AbortSignal} [signal] */
  revokeRule: (id, signal) => request(`/chat/rules/${enc(id)}`, { method: "DELETE", signal }),
};

/** Every route, by name; each returns the answer's JSON (or a Blob, or a URL). @type {import("./api-types").Api} */
export const api = {
  status: engineStatus,
  runtimes: ({ signal } = {}) => get("/chat/runtimes", undefined, signal),
  models: (runtime, { signal } = {}) => get(`/chat/runtimes/${enc(runtime)}/models`, undefined, signal),
  /** {space, effective}: the Space's runtime policy */
  runtimePolicy: ({ signal } = {}) => get("/chat/runtime-policy", undefined, signal),
  /** Replaces the Space's policy: {allowed, default, preferences, fallback}. */
  setRuntimePolicy: (policy) => send("PUT", "/chat/runtime-policy", policy),
  /** {space, project, effective}: a project chat's own override (404 no_such_chat otherwise) */
  chatRuntimePolicy: (chat, { signal } = {}) => get(`/chat/chats/${enc(chat)}/runtime-policy`, undefined, signal),
  /** Replaces a project's override; a null field follows the Space. */
  setChatRuntimePolicy: (chat, policy) => send("PUT", `/chat/chats/${enc(chat)}/runtime-policy`, policy),
  /** The Space advisory: each account's plan, usage windows and paid facts (facts only; every one with its source and age). */
  advisory: ({ signal } = {}) => get("/advisory", undefined, signal),
  /** {intents: [...]}: the founder's holds and paid modes that hold now (rows: scope, scope_id, key, value, until, cites, set_at). */
  intents: ({ signal } = {}) => get("/chat/intent", undefined, signal),
  /** The founder's paid-usage mode: {scope: "space", scope_id: "", value} or {scope: "pool", scope_id: poolId, value | null (null: follow the Space)}. */
  setPaid: (body) => send("POST", "/chat/intent/paid", body),
  router: ({ signal } = {}) => get("/chat/router", undefined, signal),
  setRouter: (body, { signal } = {}) => request("/chat/router", { method: "PUT", body, signal }),
  routerModels: ({ signal } = {}) => get("/chat/router/models", undefined, signal),
  connectRouterModel: (body, { signal } = {}) => request("/chat/router/models", { method: "POST", body, signal }),
  disconnectRouterModel: (provider, { signal } = {}) => request(`/chat/router/models/${enc(provider)}`, { method: "DELETE", signal }),

  chats: ({ signal } = {}) => chatActivityApi.chats(signal),
  chat: (id) => get(`/chat/chats/${enc(id)}`),
  patchChat: (id, body, { signal } = {}) => request(`/chat/chats/${enc(id)}`, { method: "PATCH", body, signal }),
  /** {thread?, after_seq?, before_seq?, limit?} → {messages, next_after_seq, next_before_seq?} */
  messages: (chat, query = {}, { signal } = {}) => get(`/chat/chats/${enc(chat)}/messages`, query, signal),
  /** attachments: ids uploaded to this same chat (uploadAttachment); text may be "" when there are some. */
  post: (chat, { text, threadTs, clientId: cid, attachments }) =>
    send("POST", `/chat/chats/${enc(chat)}/messages`, { text, client_id: cid, ...(threadTs ? { thread_ts: threadTs } : {}), ...(attachments && attachments.length ? { attachments } : {}) }),
  threads: (chat, { signal } = {}) => get(`/chat/chats/${enc(chat)}/threads`, undefined, signal),
  thread: (chat, ts, { signal } = {}) => get(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`, undefined, signal),
  /** {resolved?, paused?: false, title?, label?, intelligence?} */
  patchThread: (chat, ts, body) => send("PATCH", `/chat/chats/${enc(chat)}/threads/${enc(ts)}`, body),
  /** Delete a thread (Space, when it offers it: a thread row's can_delete). {keep_branch, confirm?} → {deleted, undo_until}; 409 would_lose_work {what, confirm} when its worktree holds work kept nowhere else. Undone by restoreThread until undo_until. */
  deleteThread: (chat, ts, body) => send("DELETE", `/chat/chats/${enc(chat)}/threads/${enc(ts)}`, body),
  restoreThread: (chat, ts) => send("POST", `/chat/chats/${enc(chat)}/threads/${enc(ts)}/restore`, {}),
  /** Continue a thread on another runtime: it stops, freezes, and a linked new thread starts from its work. */
  continueThread: (chat, ts, body) => request(`/chat/chats/${enc(chat)}/threads/${enc(ts)}/continue`, { method: "POST", body, timeout: 60000 }),
  hops: (chat, query = {}, { signal } = {}) => get(`/chat/chats/${enc(chat)}/hops`, query, signal),
  memory: (chat) => get(`/chat/chats/${enc(chat)}/memory`),
  /** What a chat's threads made (a newer backend): {made: [...], next_before}. 404 on an older one. */
  made: (chat, query = {}, { signal } = {}) => get(`/chat/chats/${enc(chat)}/made`, query, signal),
  pinMade: (chat, id, on) => send(on ? "PUT" : "DELETE", `/chat/chats/${enc(chat)}/made/${enc(id)}/pin`),
  /** The person looked at a chat (a newer backend keeps it per person, on every device): {seen: {seen_at, seen_seq}}. */
  markSeen: (chat) => chatActivityApi.markSeen(chat),
  memoryFile: (chat, path) => get(`/chat/chats/${enc(chat)}/memory/${enc(path)}`),

  /** {shape: object|null, version: "new"|<12 hex>, updated_at}. 404 on an older backend. */
  shape: () => get("/chat/shape"),
  /** {shape: object|null, if_version}: compare-and-set; a stale if_version is 409 shape_changed with `current`. */
  putShape: (body) => send("PUT", "/chat/shape", body),

  sessions: (query = {}, { signal } = {}) => get("/chat/sessions", query, signal),
  session: (id, { signal } = {}) => get(`/chat/sessions/${enc(id)}`, undefined, signal),
  patchSession: (id, body) => send("PATCH", `/chat/sessions/${enc(id)}`, body),
  active: ({ signal } = {}) => get("/chat/active", undefined, signal),
  /** Stored frames, for history and resumes beyond the stream's reach. */
  events: (query = {}, { signal } = {}) => get("/chat/events", query, signal),

  /** A plain chat's history lives in its CLI transcript, read by observation. */
  observedMessages: (nativeId, query = {}, { signal } = {}) => get(`/messages/${enc(nativeId)}`, query, signal),
  prompt: (body) => send("POST", "/chat/prompt", body),
  abort: (sessionId) => send("POST", "/chat/abort", { session_id: sessionId }),

  review: (query = {}, { signal } = {}) => get("/chat/review", query, signal),
  reviewItem: (id, { signal } = {}) => get(`/chat/review/${enc(id)}`, undefined, signal),
  decide: (id, body) => send("POST", `/chat/review/${enc(id)}/decision`, body),
  rules: (query) => ruleApi.rules(query),
  addRule: (body) => send("POST", "/chat/rules", body),
  revokeRule: (id) => ruleApi.revokeRule(id),

  runs: (session, query = {}, { signal } = {}) => get(`/chat/sessions/${enc(session)}/runs`, query, signal),
  run: (id, { signal } = {}) => get(`/chat/runs/${enc(id)}`, undefined, signal),
  transcript: (id, query = {}, { signal } = {}) => get(`/chat/runs/${enc(id)}/transcript`, query, signal),
  stopRun: (id) => send("POST", `/chat/runs/${enc(id)}/stop`),
  stopRuns: (session) => send("POST", `/chat/sessions/${enc(session)}/runs/stop`),

  worktrees: (chat) => chatActivityApi.worktrees(chat),
  removeWorktree: (chat, ts, confirm) => chatActivityApi.removeWorktree(chat, ts, confirm),

  ...scheduleApi,
  ...projectApi,
  /** An image inside a project, as a Blob for the image viewer (fetched, so it carries the Coder header and errors read as words). */
  projectImage: (project, relativePath, opts) => blob(`/xo-projects/${enc(project)}/image?relative_path=${enc(relativePath)}`, opts),
  /** A project file as a commit had it (the coworker service's version route): the Changes view's "Before" of a changed or deleted image (commit: /changes' base_commit). relativePath: the file now, project-relative (it may be gone); was: its name at that commit when it was renamed since (/changes' old_path, relative to the worktree). Images come inline. 404 version_not_found when the commit hadn't it. */
  projectVersion: (project, relativePath, { commit, was = null }, opts) => blob(`/coworker/xo-projects/${enc(project)}/version?relative_path=${enc(relativePath)}&commit=${enc(commit)}${was ? `&commit_path=${enc(was)}` : ""}&hidden=true`, opts),
  /** A whole project file as a Blob, for the viewer's Download (fetched, so the Coder token stays out of every URL). */
  projectDownload: (project, relativePath) => blob(`/xo-projects/${enc(project)}/download?relative_path=${enc(relativePath)}&hidden=true`, { ms: 300000 }),
  /** GitHub connector: {status: "connected"|"needs_auth", username?, avatar_url?} */
  githubStatus: ({ signal } = {}) => get("/connectors/github/status", undefined, signal),
  githubIssues: (project, refresh = false, { signal } = {}) =>
    get(`/xo-projects/${enc(project)}/github/issues`, refresh ? { refresh: "true" } : undefined, signal),
  githubIssue: (project, n, signal) => get(`/xo-projects/${enc(project)}/github/issues/${enc(n)}`, undefined, signal),
  githubPulls: (project, { signal } = {}) => get(`/xo-projects/${enc(project)}/github/pulls`, undefined, signal),
  githubPull: (project, n, signal) => get(`/xo-projects/${enc(project)}/github/pulls/${enc(n)}`, undefined, signal),
  /** Device flow: {session_id, user_code, verification_uri}; poll → {status: "pending"} until the profile. */
  githubConnect: (fresh = false) => send("POST", "/connectors/github/cli/start", undefined, fresh ? { fresh: true } : undefined),
  githubConnectPoll: (id, { signal } = {}) =>
    request("/connectors/github/cli/poll", { method: "POST", body: { session_id: id }, signal }),
  githubConnectCancel: (sessionId) => send("POST", "/connectors/github/cli/cancel", { session_id: sessionId }),
  githubDisconnect: () => send("POST", "/connectors/github/disconnect", {}),
  signInStream: async (route, { force = false, signal, on }) => {
    let res;
    try { res = await fetch(`connect/${route}${force ? "?force=1" : ""}`, { method: "POST", signal, headers: { Accept: "text/event-stream", ...coderHeaders() }, cache: "no-store", redirect: "manual" }); }
    catch (err) { if (/** @type {Error} */ (err).name === "AbortError") throw err; throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?"); }
    if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, `Space answered ${res.status}.`);
    await readJsonEvents(res, on, signal);
  },
  signInCode: (route, sessionId, code) => exchange(`connect/${route}/callback`, "POST", { session_id: sessionId, code }),
  signInCancel: (route) => exchange(`connect/${route}`, "DELETE"),

  terminalStatus: ({ signal } = {}) => get("/terminal/status", undefined, signal),
  /** {project?, path?, workspace?: true} → {terminals: [T…]}, oldest first */
  terminals: (query = {}, { signal } = {}) => get("/terminal/sessions", query, signal),
  terminal: (id, { signal } = {}) => get(`/terminal/sessions/${enc(id)}`, undefined, signal),
  /** {project?, path?, name?, rows?, cols?}; no project is a workspace shell → {terminal, ticket, ticket_expires_in} */
  openTerminal: (body) => send("POST", "/terminal/sessions", body),
  /** A fresh ticket to (re)attach: {ticket, ticket_expires_in} */
  attachTerminal: (id, { signal } = {}) => request(`/terminal/sessions/${enc(id)}/attach`, { method: "POST", signal }),
  renameTerminal: (id, name) => send("PATCH", `/terminal/sessions/${enc(id)}`, { name }),
  /** Hangs up everything started in that shell, and forgets it. */
  closeTerminal: (id) => send("DELETE", `/terminal/sessions/${enc(id)}`),

  streamUrl: () => urlOf("/chat/stream"),
};
