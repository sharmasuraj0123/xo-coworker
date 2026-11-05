// Thin client for XO Space's storm API (`/api/chat/*`, the one reference is
// /home/coder/sedc/handoffs/UI-reference.md), plus the project-creation routes.
// Same origin: serve.py proxies /api. Paths are relative to the page, so the UI
// also works under a path prefix (a hub frame).
//
// The UI owns no decision logic: risk, allowed scopes, rule sentences, routing
// and permission answers come from the server; this client only carries them.

const BASE = "api";

// Inside a Coder workspace, the app is opened at `?coder_session_token=…`
// (xo-swarm does this). Coder accepts that for the page load, but the cookie
// it sets lasts a minute, after which every request here is redirected to
// Coder's sign-in on another origin and fails CORS. So the token is kept for
// this tab, taken out of the address bar, and sent on every request.
const TOKEN_PARAM = "coder_session_token";
const TOKEN_KEY = "xo-coder-token";
const coderToken = (() => {
  let token = null;
  try {
    const url = new URL(location.href);
    token = url.searchParams.get(TOKEN_PARAM);
    if (token) {
      url.searchParams.delete(TOKEN_PARAM);
      history.replaceState(history.state, "", url);
    }
  } catch { /* not in a browser */ }
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else token = sessionStorage.getItem(TOKEN_KEY);
  } catch { /* storage blocked: this page load still has the token */ }
  return token;
})();

/** Headers that keep Coder's app proxy signing requests in. */
export const coderHeaders = () => (coderToken ? { "Coder-Session-Token": coderToken } : {});

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra); // storm extras: feature, count, sentence, what, confirm, summary, current
  }
}

/** The storm codes that mean "storm can't be used in this server right now" (UI-reference §0.3). */
export const STORM_DOWN = new Set(["engine_not_running", "engine_elsewhere", "engine_failed", "store_refused", "store_failed", "stream_not_running"]);

// How long a request may go unanswered before it gives up (if1 #6). A write that never settles
// would stay "Sending" with no Retry; a read that never settles would stall its poll for good.
export const WRITE_MS = 20000;
export const READ_MS = 30000;

/** One signal that aborts on the caller's signal or after `ms`; `timedOut()` says which. */
function deadline(signal, ms) {
  const ctl = new AbortController();
  let late = false;
  const t = setTimeout(() => { late = true; ctl.abort(); }, ms);
  const onAbort = () => ctl.abort();
  if (signal) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctl.signal,
    timedOut: () => late,
    done: () => { clearTimeout(t); if (signal) signal.removeEventListener("abort", onAbort); },
  };
}

export async function request(path, { method = "GET", body, signal, query, timeout } = {}) {
  let url = BASE + path;
  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null && v !== "") q.set(k, String(v));
    const qs = q.toString();
    if (qs) url += "?" + qs;
  }
  const ms = timeout ?? (method === "GET" ? READ_MS : WRITE_MS);
  const dl = deadline(signal, ms);
  try {
    return await exchange(url, method, body, dl.signal);
  } catch (err) {
    if (err && err.name === "AbortError" && dl.timedOut()) {
      throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    }
    throw err;
  } finally {
    dl.done();
  }
}

async function exchange(url, method, body, signal) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      // A redirect here is Coder sending us to sign in, which fetch can't follow.
      redirect: "manual",
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
  if (res.type === "opaqueredirect") {
    throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
  }
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    // Four error shapes (UI-reference §0.2): storm's {detail: {code, message, …extras}}, FastAPI's
    // 422 list, a plain-string detail, and serve.py's own.
    const d = data && data.detail;
    const code = (d && d.code) || (data && data.error) || `http_${res.status}`;
    let message = (d && d.message) || (typeof d === "string" ? d : "");
    if (Array.isArray(d)) message = d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
    if (!message) message = `${res.status} ${res.statusText || "error"}`;
    const extra = {};
    if (d && typeof d === "object" && !Array.isArray(d)) for (const k of ["feature", "count", "sentence", "what", "confirm", "summary", "current"]) if (k in d) extra[k] = d[k];
    throw new ApiError(res.status, code, message, extra);
  }
  return data;
}

const enc = encodeURIComponent;

/** An ApiError from a non-2xx answer whose body is `text` (any of the four error shapes). */
function errorOf(status, statusText, text) {
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  const d = data && data.detail;
  const code = (d && d.code) || (data && data.error) || `http_${status}`;
  let message = (d && d.message) || (typeof d === "string" ? d : "");
  if (Array.isArray(d)) message = d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  if (!message) message = `${status} ${statusText || "error"}`;
  return new ApiError(status, code, message);
}

// ── attachments (hub #30): a file is (chat id, attachment id); the browser never sees a path ──
const attPath = (chat, id) => `${BASE}/chat/chats/${enc(chat)}/attachments/${enc(id)}`;

/**
 * The URL an <img> or <iframe> loads an attachment from. Those can't send headers, so inside Coder
 * the token rides in the query (serve.py takes it out before forwarding, as for the stream).
 */
export const attachmentUrl = (chat, id) => attPath(chat, id) + (coderToken ? `?${TOKEN_PARAM}=${enc(coderToken)}` : "");

/**
 * The ws(s):// URL of a shell's socket, relative to the page like every other call. A WebSocket
 * can't send headers either, so inside Coder the token rides in the query; serve.py drops the
 * whole query before the tunnel. The attach ticket never goes in the URL: it is the first message.
 */
export function terminalSocketUrl(id) {
  const url = new URL(`${BASE}/terminal/sessions/${enc(id)}/ws`, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = coderToken ? `?${TOKEN_PARAM}=${enc(coderToken)}` : "";
  return url.href;
}

/** An attachment's text, for the viewer (the server always sends text as text/plain). */
export async function attachmentText(chat, id, { signal } = {}) {
  const dl = deadline(signal, READ_MS);
  let res;
  try {
    res = await fetch(attPath(chat, id), { signal: dl.signal, headers: coderHeaders(), redirect: "manual" });
    if (res.type === "opaqueredirect") throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
    const text = await res.text();
    if (!res.ok) throw errorOf(res.status, res.statusText, text);
    return text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && err.name === "AbortError" && dl.timedOut()) throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(READ_MS / 1000)} s.`);
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  } finally {
    dl.done();
  }
}

/**
 * Upload one file's raw bytes to a chat. XMLHttpRequest, since fetch has no upload progress.
 * Returns {promise → {id, name, type, bytes}, abort()}; onProgress(sent, total) as it goes.
 * An abort rejects with an AbortError.
 */
export function uploadAttachment(chat, blob, name, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open("POST", `${BASE}/chat/chats/${enc(chat)}/attachments?name=${enc(name)}`);
    for (const [k, v] of Object.entries(coderHeaders())) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded, e.lengthComputable ? e.total : blob.size);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new ApiError(xhr.status, "bad_answer", "XO's answer to the upload wasn't readable.")); }
      } else reject(errorOf(xhr.status, xhr.statusText, xhr.responseText));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?"));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { name: "AbortError" }));
    xhr.send(blob);
  });
  return { promise, abort: () => xhr.abort() };
}
const get = (path, query) => request(path, { query });
const send = (method, path, body, query) => request(path, { method, body, query });

/** GET a file's bytes as a Blob; failures throw the same ApiErrors as `request`. */
async function blob(path, { signal, ms = READ_MS } = {}) {
  const dl = deadline(signal, ms);
  try {
    const res = await fetch(BASE + path, { signal: dl.signal, headers: coderHeaders(), cache: "no-store", redirect: "manual" });
    if (res.type === "opaqueredirect") throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
    if (res.ok) return await res.blob();
    let d = null;
    try { d = (await res.json()).detail; } catch { /* not JSON */ }
    throw new ApiError(res.status, (d && d.code) || `http_${res.status}`, (d && d.message) || (typeof d === "string" ? d : "") || `${res.status} ${res.statusText || "error"}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && err.name === "AbortError" && dl.timedOut()) throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  } finally {
    dl.done();
  }
}

/** A fresh id for a write that must never happen twice (UI-reference §0.7). */
export const clientId = () => `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** The largest seq: "the newest page" is the page just before it. */
export const NEWEST = 9007199254740991;

export const api = {
  // ── the engine, the runtimes, the router (U1 status, U2 settings) ─────────
  status: () => get("/chat/status"),
  runtimes: () => get("/chat/runtimes"),
  models: (runtime) => get(`/chat/runtimes/${enc(runtime)}/models`),
  /** {space, effective}: the Space's runtime policy (mixed runtimes §2.2) */
  runtimePolicy: () => get("/chat/runtime-policy"),
  /** Replaces the Space's policy: {allowed, default, preferences, fallback}. */
  setRuntimePolicy: (policy) => send("PUT", "/chat/runtime-policy", policy),
  /** {space, project, effective}: a project chat's own override (404 no_such_chat otherwise) */
  chatRuntimePolicy: (chat) => get(`/chat/chats/${enc(chat)}/runtime-policy`),
  /** Replaces a project's override; a null field follows the Space. */
  setChatRuntimePolicy: (chat, policy) => send("PUT", `/chat/chats/${enc(chat)}/runtime-policy`, policy),
  router: () => get("/chat/router"),
  setRouter: (body) => send("PUT", "/chat/router", body),
  routerModels: () => get("/chat/router/models"),
  connectRouterModel: (body) => send("POST", "/chat/router/models", body),
  disconnectRouterModel: (provider) => send("DELETE", `/chat/router/models/${enc(provider)}`),

  // ── chats, messages, threads, hops, memory ────────────────────────────────
  chats: () => get("/chat/chats"),
  chat: (id) => get(`/chat/chats/${enc(id)}`),
  patchChat: (id, body) => send("PATCH", `/chat/chats/${enc(id)}`, body),
  /** {thread?, after_seq?, before_seq?, limit?} → {messages, next_after_seq, next_before_seq?} */
  messages: (chat, query = {}) => get(`/chat/chats/${enc(chat)}/messages`, query),
  /** attachments: ids uploaded to this same chat (uploadAttachment); text may be "" when there are some. */
  post: (chat, { text, threadTs, clientId: cid, attachments }) =>
    send("POST", `/chat/chats/${enc(chat)}/messages`, { text, client_id: cid, ...(threadTs ? { thread_ts: threadTs } : {}), ...(attachments && attachments.length ? { attachments } : {}) }),
  threads: (chat) => get(`/chat/chats/${enc(chat)}/threads`),
  thread: (chat, ts) => get(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`),
  /** {resolved?, paused?: false, title?, label?, intelligence?} */
  patchThread: (chat, ts, body) => send("PATCH", `/chat/chats/${enc(chat)}/threads/${enc(ts)}`, body),
  /** Continue a thread on another runtime (§2.4): it stops, freezes, and a linked new thread starts from its work. */
  continueThread: (chat, ts, body) => request(`/chat/chats/${enc(chat)}/threads/${enc(ts)}/continue`, { method: "POST", body, timeout: 60000 }),
  hops: (chat, query = {}) => get(`/chat/chats/${enc(chat)}/hops`, query),
  memory: (chat) => get(`/chat/chats/${enc(chat)}/memory`),
  /** What a chat's threads made (a newer backend): {made: [...], next_before}. 404 on an older one. */
  made: (chat, query = {}) => get(`/chat/chats/${enc(chat)}/made`, query),
  pinMade: (chat, id, on) => send(on ? "PUT" : "DELETE", `/chat/chats/${enc(chat)}/made/${enc(id)}/pin`),
  /** The person looked at a chat (a newer backend keeps it per person, on every device): {seen: {seen_at, seen_seq}}. */
  markSeen: (chat) => send("PUT", `/chat/chats/${enc(chat)}/seen`, {}),
  memoryFile: (chat, path) => get(`/chat/chats/${enc(chat)}/memory/${enc(path)}`),

  // ── the person's shape (xo-space 8c6bc03): their own layer of the UI, kept for every device ──
  /** {shape: object|null, version: "new"|<12 hex>, updated_at}. 404 on an older backend. */
  shape: () => get("/chat/shape"),
  /** {shape: object|null, if_version}: compare-and-set; a stale if_version is 409 shape_changed with `current`. */
  putShape: (body) => send("PUT", "/chat/shape", body),

  // ── sessions, turns, history ──────────────────────────────────────────────
  sessions: (query = {}) => get("/chat/sessions", query),
  session: (id) => get(`/chat/sessions/${enc(id)}`),
  patchSession: (id, body) => send("PATCH", `/chat/sessions/${enc(id)}`, body),
  active: () => get("/chat/active"),
  /** Stored frames, for history and resumes beyond the stream's reach. */
  events: (query = {}) => get("/chat/events", query),

  // ── plain chat and control ────────────────────────────────────────────────
  /** A plain chat's history lives in its CLI transcript, read by observation (UI-reference §2.1). */
  observedMessages: (nativeId, query = {}) => get(`/messages/${enc(nativeId)}`, query),
  prompt: (body) => send("POST", "/chat/prompt", body),
  abort: (sessionId) => send("POST", "/chat/abort", { session_id: sessionId }),

  // ── review and rules (U2) ─────────────────────────────────────────────────
  review: (query = {}) => get("/chat/review", query),
  reviewItem: (id) => get(`/chat/review/${enc(id)}`),
  decide: (id, body) => send("POST", `/chat/review/${enc(id)}/decision`, body),
  rules: (query = {}) => get("/chat/rules", query),
  addRule: (body) => send("POST", "/chat/rules", body),
  revokeRule: (id) => send("DELETE", `/chat/rules/${enc(id)}`),

  // ── sub-agent runs (U2) ───────────────────────────────────────────────────
  runs: (session, query = {}) => get(`/chat/sessions/${enc(session)}/runs`, query),
  run: (id) => get(`/chat/runs/${enc(id)}`),
  transcript: (id, query = {}) => get(`/chat/runs/${enc(id)}/transcript`, query),
  stopRun: (id) => send("POST", `/chat/runs/${enc(id)}/stop`),
  stopRuns: (session) => send("POST", `/chat/sessions/${enc(session)}/runs/stop`),

  // ── worktrees (U2) ────────────────────────────────────────────────────────
  worktrees: (chat) => get("/chat/worktrees", chat ? { chat } : undefined),
  removeWorktree: (chat, ts, confirm) => send("DELETE", `/chat/worktrees/${enc(chat)}/${enc(ts)}`, undefined, confirm ? { confirm } : undefined),

  // ── jobs ─────────────────────────────────────────────────────────────────
  schedules: () => get("/schedules"),
  schedule: (id) => get(`/schedules/${enc(id)}`),
  scheduleRuns: (id, query = {}) => get(`/schedules/${enc(id)}/runs`, query),

  // ── projects ──────────────────────────────────────────────────────────────
  /** A text file inside a project, for the file viewer: {name, kind, size_bytes, truncated, content, …}. */
  projectFile: (project, relativePath, at, { purpose } = {}) => get(`/xo-projects/${enc(project)}/file`, { relative_path: relativePath, ...(at ? { commit: at.commit, commit_path: at.path } : {}), ...(purpose ? { purpose } : {}) }),
  /**
   * Save a project file (Space; serve.py adds the UI's writer key). base_version: the version you started
   * from. → {version, saved_at, edit_id}; 409 file_changed {current: {content, version}}; 428
   * confirm_required (send again with confirm "runs_code"); 403 read_only_place | ui_only | outside_project.
   */
  saveProjectFile: (project, relativePath, content, baseVersion, confirm) =>
    send("PUT", `/xo-projects/${enc(project)}/file`, { relative_path: relativePath, content, base_version: baseVersion, ...(confirm ? { confirm } : {}) }),
  /** Undo a save (Space's edit log): the file goes back to what it was before that save. */
  undoProjectEdit: (project, editId) => send("POST", `/xo-projects/${enc(project)}/edits/${enc(editId)}/undo`, {}),
  /**
   * What changed in a project (Space, design-research/2026-11-vision/pierre): a thread's worktree against
   * where its branch left the default branch, uncommitted work included, or the project's own checkout
   * against its HEAD. {root, base_commit, head_commit, computed_at, truncated, files: [{path, old_path?,
   * status, additions, deletions, binary, version, patch, patch_omitted?}]}. path: one file (up to 1 MB).
   */
  projectChanges: (project, { worktree, path } = {}) => get(`/xo-projects/${enc(project)}/changes`, { ...(worktree ? { worktree } : {}), ...(path ? { path } : {}) }),
  /** One folder of a project, a level at a time (a thread's worktree is `.xo/worktrees/<name>`): {dirs, files}. */
  projectTree: (project, relativePath) => get(`/xo-projects/${enc(project)}/tree`, relativePath ? { relative_path: relativePath } : undefined),
  /** An image inside a project, as a Blob for the image viewer (fetched, so it carries the Coder header and errors read as words). */
  projectImage: (project, relativePath, opts) => blob(`/xo-projects/${enc(project)}/image?relative_path=${enc(relativePath)}`, opts),
  /** A whole project file as a Blob, for the viewer's Download (fetched, so the Coder token stays out of every URL). */
  projectDownload: (project, relativePath) => blob(`/xo-projects/${enc(project)}/download?relative_path=${enc(relativePath)}`, { ms: 300000 }),
  /** Where xo-projects live: {roots: {...}, default}. Never hard-code the root. */
  workspaceConfig: () => get("/config/workspace"),
  /** Scaffold a new xo-project (xo-cowork-api). 409 when the folder exists. */
  createProject: ({ path, displayName, description }) =>
    send("POST", "/files/mkdir", { path, scaffold: true, display_name: displayName, ...(description ? { description } : {}) }),

  // ── shells (/api/terminal/*): T = {id, name, scope, project, path, cwd, status, foreground, viewers, …} ──
  terminalStatus: () => get("/terminal/status"),
  /** {project?, path?, workspace?: true} → {terminals: [T…]}, oldest first */
  terminals: (query = {}) => get("/terminal/sessions", query),
  terminal: (id) => get(`/terminal/sessions/${enc(id)}`),
  /** {project?, path?, name?, rows?, cols?}; no project is a workspace shell → {terminal, ticket, ticket_expires_in} */
  openTerminal: (body) => send("POST", "/terminal/sessions", body),
  /** A fresh ticket to (re)attach: {ticket, ticket_expires_in} */
  attachTerminal: (id) => send("POST", `/terminal/sessions/${enc(id)}/attach`),
  renameTerminal: (id, name) => send("PATCH", `/terminal/sessions/${enc(id)}`, { name }),
  /** Hangs up everything started in that shell, and forgets it. */
  closeTerminal: (id) => send("DELETE", `/terminal/sessions/${enc(id)}`),

  // ── the one global stream ─────────────────────────────────────────────────
  streamUrl: () => `${BASE}/chat/stream`,
};
