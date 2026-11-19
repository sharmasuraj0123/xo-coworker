// @ts-check

// Requests to XO Space through serve.py, relative to the page; inside Coder the session token rides on every one.

const BASE = "api";
const enc = encodeURIComponent;

const TOKEN_PARAM = "coder_session_token";
const TOKEN_KEY = "xo-coder-token";
/** Coder's sign-in cookie lasts a minute, so the token is kept for this tab and taken out of the address bar. */
const coderToken = (() => {
  /** @type {string | null} */
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

/** Headers that keep Coder's app proxy signing requests in. @returns {Record<string, string>} */
export const coderHeaders = () => (coderToken ? { "Coder-Session-Token": coderToken } : {});

export class ApiError extends Error {
  /** @param {number} status @param {string} code @param {string} message @param {Record<string, unknown>} [extra] storm's feature, count, sentence, what, confirm, summary, current */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

/** How long a request may go unanswered: a write that never settles would stay "Sending" with no Retry. */
const WRITE_MS = 20000;
const READ_MS = 30000;

/** One signal that aborts on the caller's signal or after `ms`; `timedOut()` says which. @param {AbortSignal | null | undefined} signal @param {number} ms */
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

/** @typedef {{ method?: string, body?: unknown, signal?: AbortSignal, query?: Record<string, unknown>, timeout?: number, headers?: Record<string, string> | null }} RequestOptions */

/** A JSON request to `api` + path; failures throw ApiError (timeout, network, signed_out, or the answer's own code). @param {string} path @param {RequestOptions} [opts] @returns {Promise<any>} */
export async function request(path, { method = "GET", body, signal, query, timeout, headers = null } = {}) {
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
    return await exchange(url, method, body, dl.signal, headers);
  } catch (err) {
    if (err && /** @type {Error} */ (err).name === "AbortError" && dl.timedOut()) {
      throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    }
    throw err;
  } finally {
    dl.done();
  }
}

/** @param {string} url @param {string} method @param {unknown} body @param {AbortSignal} signal @param {Record<string, string> | null} [extra] */
async function exchange(url, method, body, signal, extra = null) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...coderHeaders(), ...(extra || {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      // a redirect here is Coder sending us to sign in, which fetch can't follow
      redirect: "manual",
    });
  } catch (err) {
    if (/** @type {Error} */ (err).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
  if (res.type === "opaqueredirect") {
    throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
  }
  if (!res.ok) throw await failure(res);
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** A Space without this route yet: FastAPI's bare 404 ("http_404") or 405; a route's own 404 names what isn't there. @param {any} err */
export const missingRoute = (err) => !!err && (err.status === 405 || (err.status === 404 && (!err.code || err.code === "http_404")));

/** The one error parser: storm's {detail: {code, message, …extras}}, FastAPI's 422 list, a plain-string detail, or serve.py's own. @param {number} status @param {string} statusText @param {string} text */
function errorOf(status, statusText, text) {
  /** @type {any} */
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  const d = data && data.detail;
  const code = (d && d.code) || (data && data.error) || `http_${status}`;
  let message = (d && d.message) || (typeof d === "string" ? d : "");
  if (Array.isArray(d)) message = d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  if (!message) message = `${status} ${statusText || "error"}`;
  /** @type {Record<string, unknown>} */
  const extra = {};
  if (d && typeof d === "object" && !Array.isArray(d)) for (const k of ["feature", "count", "sentence", "what", "confirm", "summary", "current"]) if (k in d) extra[k] = d[k];
  return new ApiError(status, code, message, extra);
}

/** A failed answer as an ApiError; a body that can't be read still keeps the answer's status. @param {Response} res */
const failure = async (res) => errorOf(res.status, res.statusText, await res.text().catch(() => ""));

/** The page-relative URL of a route. @param {string} path */
export const urlOf = (path) => BASE + path;

/** The URL for what can't send headers (an <img>, an <iframe>): the token rides in the query, and serve.py takes it out. @param {string} path */
export const signedUrl = (path) => BASE + path + (coderToken ? `?${TOKEN_PARAM}=${enc(coderToken)}` : "");

/** The ws(s):// URL of a socket, relative to the page; the token rides in the query, which serve.py drops before the tunnel. @param {string} path */
export function socketUrl(path) {
  const url = new URL(BASE + path, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = coderToken ? `?${TOKEN_PARAM}=${enc(coderToken)}` : "";
  return url.href;
}

/** A body read as text. @param {string} path @param {{ signal?: AbortSignal }} [opts] */
export async function text(path, { signal } = {}) {
  const dl = deadline(signal, READ_MS);
  let res;
  try {
    res = await fetch(BASE + path, { signal: dl.signal, headers: coderHeaders(), redirect: "manual" });
    if (res.type === "opaqueredirect") throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
    if (!res.ok) throw await failure(res);
    return await res.text();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && /** @type {Error} */ (err).name === "AbortError" && dl.timedOut()) throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(READ_MS / 1000)} s.`);
    if (err && /** @type {Error} */ (err).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  } finally {
    dl.done();
  }
}

/** POST raw bytes with upload progress (XMLHttpRequest: fetch has none); an abort rejects with an AbortError. @param {string} path @param {Blob} body @param {{ onProgress?: (sent: number, total: number) => void }} [opts] */
export function upload(path, body, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  /** @type {Promise<any>} */
  const promise = new Promise((resolve, reject) => {
    xhr.open("POST", BASE + path);
    for (const [k, v] of Object.entries(coderHeaders())) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded, e.lengthComputable ? e.total : body.size);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new ApiError(xhr.status, "bad_answer", "XO's answer to the upload wasn't readable.")); }
      } else reject(errorOf(xhr.status, xhr.statusText, xhr.responseText));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?"));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { name: "AbortError" }));
    xhr.send(body);
  });
  return { promise, abort: () => xhr.abort() };
}

/** GET a file's bytes as a Blob; failures throw the same ApiErrors as `request`. @param {string} path @param {{ signal?: AbortSignal, ms?: number }} [opts] */
export async function blob(path, { signal, ms = READ_MS } = {}) {
  const dl = deadline(signal, ms);
  try {
    const res = await fetch(BASE + path, { signal: dl.signal, headers: coderHeaders(), cache: "no-store", redirect: "manual" });
    if (res.type === "opaqueredirect") throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
    if (res.ok) return await res.blob();
    throw await failure(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && /** @type {Error} */ (err).name === "AbortError" && dl.timedOut()) throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    if (err && /** @type {Error} */ (err).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  } finally {
    dl.done();
  }
}

/** A fresh id for a write that must never happen twice. */
export const clientId = () => `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
