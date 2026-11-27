// @ts-check

import { blob, signedUrl, socketUrl, text, upload, urlOf } from "./http.js";
import { projectApi } from "./project-api.js";
import { scheduleApi } from "./schedule-response.js";
import { checkedResponse, engineStatus, requestChecked } from "./response.js";
import { isAccountIntents, isAdvisory, isPaidReceipt } from "./account-responses.js";
import { isReview, isReviewPage, isRule, isRuleBatch } from "./review-responses.js";
import { isMade, isMadeItem, isMemory, isMemoryFile, isShape, isWorktree, isWorktreeRemoval, isWorktrees } from "./record-responses.js";
import { isModels, isPolicies, isRouter, isRouterModels, isRuntimes } from "./runtime-responses.js";
import { isRunDetail, isRunList, isRunTranscript, isStopRunReceipt, isStopRunsReceipt } from "./run-responses.js";
import {
  isAbortReceipt, isActive, isChat, isChats, isEvents, isHops, isMessage, isMessages, isObservedPage,
  isPromptReceipt, isSeenAck, isSession, isSessions, isThread, isThreadContinuation, isThreadDeletion, isThreads,
} from "./chat-responses.js";
import { isUploadedAttachment } from "./attachment-response.js";
import { terminalApi } from "./terminal-response.js";
import { githubAuthApi } from "./github-auth-response.js";
import { githubIssue, githubIssues, githubPull, githubPulls } from "./github-issues-response.js";
import { signInApi } from "./sign-in-response.js";
import { lifecycleApi } from "./lifecycle-response.js";
import { launchpadActionsApi } from "./launchpad-actions-response.js";
import { launchpadCheck, launchpadPreflight } from "./launchpad-check-response.js";
import { launchpadDeploy, launchpadWatch } from "./launchpad-stream.js";
export { coderHeaders, ApiError, missingRoute, clientId } from "./http.js";

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
  const path = `/chat/chats/${enc(chat)}/attachments`;
  const { promise, abort } = upload(path + `?name=${enc(name)}`, blob, { onProgress });
  return { promise: promise.then((value) => checkedResponse(value, isUploadedAttachment, `POST ${path}`)), abort };
};

/** The largest seq: "the newest page" is the page just before it. */
export const NEWEST = 9007199254740991;

export const chatActivityApi = {
  /** @param {AbortSignal} [signal] */
  chats: (signal) => requestChecked("/chat/chats", isChats, { signal }),
  /** @param {string} chat @param {AbortSignal} [signal] */
  markSeen: (chat, signal) => requestChecked(`/chat/chats/${enc(chat)}/seen`, isSeenAck, { method: "PUT", body: {}, signal }),
  /** @param {string | null} [chat] @param {AbortSignal} [signal] @param {string | null} [cursor] */
  worktrees: (chat, signal, cursor) => requestChecked("/chat/worktrees", isWorktrees, { query: { chat, cursor }, signal }),
  /** @param {string} chat @param {string} thread @param {string | null} [confirm] @param {AbortSignal} [signal] */
  removeWorktree: (chat, thread, confirm, signal) => requestChecked(`/chat/worktrees/${enc(chat)}/${enc(thread)}`, isWorktreeRemoval, {
    method: "DELETE", query: confirm ? { confirm } : undefined, signal,
  }),
  /** @param {string} chat @param {string} thread @param {AbortSignal} [signal] */
  checkWorktree: (chat, thread, signal) => requestChecked(`/chat/worktrees/${enc(chat)}/${enc(thread)}/check`, isWorktree, {
    method: "POST", body: {}, signal,
  }),
};

export const ruleApi = {
  /** @param {Record<string, unknown>} [query] @param {AbortSignal} [signal] */
  rules: (query, signal) => requestChecked("/chat/rules", isRuleBatch, { query, signal }),
  /** @param {string} id @param {AbortSignal} [signal] */
  revokeRule: (id, signal) => requestChecked(`/chat/rules/${enc(id)}`, isRule, { method: "DELETE", signal }),
};

/** Every route, by name; each returns the answer's JSON (or a Blob, or a URL). @type {import("./api-types").Api} */
export const api = {
  status: engineStatus,
  runtimes: (options) => requestChecked("/chat/runtimes", isRuntimes, options),
  models: (runtime, options) => requestChecked(`/chat/runtimes/${enc(runtime)}/models`, isModels, options),
  /** {space, effective}: the Space's runtime policy */
  runtimePolicy: (options) => requestChecked("/chat/runtime-policy", isPolicies, options),
  /** Replaces the Space's policy: {allowed, default, preferences, fallback}. */
  setRuntimePolicy: (policy) => requestChecked("/chat/runtime-policy", isPolicies, { method: "PUT", body: policy }),
  /** {space, project, effective}: a project chat's own override (404 no_such_chat otherwise) */
  chatRuntimePolicy: (chat, options) => requestChecked(`/chat/chats/${enc(chat)}/runtime-policy`, isPolicies, options),
  /** Replaces a project's override; a null field follows the Space. */
  setChatRuntimePolicy: (chat, policy) =>
    requestChecked(`/chat/chats/${enc(chat)}/runtime-policy`, isPolicies, { method: "PUT", body: policy }),
  /** The Space advisory: each account's plan, usage windows and paid facts (facts only; every one with its source and age). */
  advisory: (options) => requestChecked("/advisory", isAdvisory, options),
  /** {intents: [...]}: the founder's holds and paid modes that hold now (rows: scope, scope_id, key, value, until, cites, set_at). */
  intents: (options) => requestChecked("/chat/intent", isAccountIntents, options),
  /** The founder's paid-usage mode: {scope: "space", scope_id: "", value} or {scope: "pool", scope_id: poolId, value | null (null: follow the Space)}. */
  setPaid: (body) => requestChecked("/chat/intent/paid", isPaidReceipt, { method: "POST", body }),
  router: (options) => requestChecked("/chat/router", isRouter, options),
  setRouter: (body, options) => requestChecked("/chat/router", isRouter, { ...options, method: "PUT", body }),
  routerModels: (options) => requestChecked("/chat/router/models", isRouterModels, options),
  connectRouterModel: (body, options) => requestChecked("/chat/router/models", isRouterModels, { ...options, method: "POST", body }),
  disconnectRouterModel: (provider, options) =>
    requestChecked(`/chat/router/models/${enc(provider)}`, isRouterModels, { ...options, method: "DELETE" }),

  chats: ({ signal } = {}) => chatActivityApi.chats(signal),
  chat: (id) => requestChecked(`/chat/chats/${enc(id)}`, isChat),
  patchChat: (id, body, options) => requestChecked(`/chat/chats/${enc(id)}`, isChat, { ...options, method: "PATCH", body }),
  /** {thread?, after_seq?, before_seq?, limit?} → {messages, next_after_seq, next_before_seq?} */
  messages: (chat, query = {}, { signal } = {}) =>
    requestChecked(`/chat/chats/${enc(chat)}/messages`, isMessages, { query, signal }),
  /** attachments: ids uploaded to this same chat (uploadAttachment); text may be "" when there are some. */
  post: (chat, { text, threadTs, clientId: cid, attachments }) =>
    requestChecked(`/chat/chats/${enc(chat)}/messages`, isMessage, { method: "POST", body: {
      text, client_id: cid, ...(threadTs ? { thread_ts: threadTs } : {}), ...(attachments?.length ? { attachments } : {}),
    } }),
  threads: (chat, options) => requestChecked(`/chat/chats/${enc(chat)}/threads`, isThreads, options),
  thread: (chat, ts, options) => requestChecked(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`, isThread, options),
  /** {resolved?, paused?: false, title?, label?, intelligence?} */
  patchThread: (chat, ts, body) =>
    requestChecked(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`, isThread, { method: "PATCH", body }),
  /** Delete a thread (Space, when it offers it: a thread row's can_delete). {keep_branch, confirm?} → {deleted, undo_until}; 409 would_lose_work {what, confirm} when its worktree holds work kept nowhere else. Undone by restoreThread until undo_until. */
  deleteThread: (chat, ts, body) =>
    requestChecked(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`, isThreadDeletion, { method: "DELETE", body }),
  restoreThread: (chat, ts) =>
    requestChecked(`/chat/chats/${enc(chat)}/threads/${enc(ts)}/restore`, isThread, { method: "POST", body: {} }),
  /** Continue a thread on another runtime: it stops, freezes, and a linked new thread starts from its work. */
  continueThread: (chat, ts, body) => requestChecked(`/chat/chats/${enc(chat)}/threads/${enc(ts)}/continue`,
    isThreadContinuation, { method: "POST", body, timeout: 60000 }),
  hops: (chat, query = {}, { signal } = {}) => requestChecked(`/chat/chats/${enc(chat)}/hops`, isHops, { query, signal }),
  memory: (chat) => requestChecked(`/chat/chats/${enc(chat)}/memory`, isMemory),
  /** What a chat's threads made (a newer backend): {made: [...], next_before}. 404 on an older one. */
  made: (chat, query = {}, { signal } = {}) => requestChecked(`/chat/chats/${enc(chat)}/made`, isMade, { query, signal }),
  pinMade: (chat, id, on) =>
    requestChecked(`/chat/chats/${enc(chat)}/made/${enc(id)}/pin`, isMadeItem, { method: on ? "PUT" : "DELETE" }),
  /** The person looked at a chat (a newer backend keeps it per person, on every device): {seen: {seen_at, seen_seq}}. */
  markSeen: (chat) => chatActivityApi.markSeen(chat),
  memoryFile: (chat, path) => requestChecked(`/chat/chats/${enc(chat)}/memory/${enc(path)}`, isMemoryFile),

  /** {shape: object|null, version: "new"|<12 hex>, updated_at}. 404 on an older backend. */
  shape: () => requestChecked("/chat/shape", isShape),
  /** {shape: object|null, if_version}: compare-and-set; a stale if_version is 409 shape_changed with `current`. */
  putShape: (body) => requestChecked("/chat/shape", isShape, { method: "PUT", body }),

  sessions: (query = {}, { signal } = {}) => requestChecked("/chat/sessions", isSessions, { query, signal }),
  session: (id, options) => requestChecked(`/chat/sessions/${enc(id)}`, isSession, options),
  patchSession: (id, body) => requestChecked(`/chat/sessions/${enc(id)}`, isSession, { method: "PATCH", body }),
  active: ({ signal } = {}) => requestChecked("/chat/active", isActive, { signal }),
  /** Stored frames, for history and resumes beyond the stream's reach. */
  events: (query = {}, { signal } = {}) => requestChecked("/chat/events", isEvents, { query, signal }),

  /** A plain chat's history lives in its CLI transcript, read by observation. */
  observedMessages: (nativeId, query = {}, { signal } = {}) =>
    requestChecked(`/messages/${enc(nativeId)}`, isObservedPage, { query, signal }),
  prompt: (body) => requestChecked("/chat/prompt", isPromptReceipt, { method: "POST", body }),
  abort: (sessionId) =>
    requestChecked("/chat/abort", isAbortReceipt, { method: "POST", body: { session_id: sessionId } }),

  review: (query = {}, { signal } = {}) => requestChecked("/chat/review", isReviewPage, { query, signal }),
  reviewItem: (id, options) => requestChecked(`/chat/review/${enc(id)}`, isReview, options),
  decide: (id, body) => requestChecked(`/chat/review/${enc(id)}/decision`, isReview, { method: "POST", body }),
  rules: (query) => ruleApi.rules(query),
  addRule: (body) => requestChecked("/chat/rules", isRule, { method: "POST", body }),
  revokeRule: (id) => ruleApi.revokeRule(id),

  runs: (session, query = {}, { signal } = {}) => requestChecked(`/chat/sessions/${enc(session)}/runs`, isRunList, { query, signal }),
  run: (id, options) => requestChecked(`/chat/runs/${enc(id)}`, isRunDetail, options),
  transcript: (id, query = {}, { signal } = {}) =>
    requestChecked(`/chat/runs/${enc(id)}/transcript`, isRunTranscript, { query, signal }),
  stopRun: (id) => requestChecked(`/chat/runs/${enc(id)}/stop`, isStopRunReceipt, { method: "POST" }),
  stopRuns: (session) => requestChecked(`/chat/sessions/${enc(session)}/runs/stop`, isStopRunsReceipt, { method: "POST" }),

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
  ...githubAuthApi,
  githubIssues,
  githubIssue,
  githubPulls,
  githubPull,
  ...signInApi,
  ...lifecycleApi,
  ...launchpadActionsApi,
  launchpadCheck,
  launchpadPreflight,
  launchpadDeploy,
  launchpadWatch,

  ...terminalApi,

  streamUrl: () => urlOf("/chat/stream"),
};
