// @ts-check
import { createScope } from "../kernel/scope.js";
import { read, write, reportStorageFailure } from "./storage.js";
import { reportFailure } from "./util.js";

// Requests to XO Space through serve.py, relative to the page; inside Coder the session token rides on every one.

const BASE = "api";
export const CHAT_STATUS_PATH = "/chat/status";

const TOKEN_PARAM = "coder_session_token";
const TOKEN_KEY = "xo-coder-token";
/** Coder's sign-in cookie lasts a minute, so the token is kept for this tab and taken out of the address bar. */
const coderToken = (() => {
  /** @type {string | null} */
  let token = null;
  if (typeof location !== "undefined") {
    const url = new URL(location.href);
    token = url.searchParams.get(TOKEN_PARAM);
    if (token) {
      url.searchParams.delete(TOKEN_PARAM);
      try { history.replaceState(history.state, "", url); }
      catch (error) { if (!(error instanceof DOMException && error.name === "SecurityError")) reportFailure(error); }
    }
  }
  if (token) write(TOKEN_KEY, token, "session", reportStorageFailure);
  else token = read(TOKEN_KEY, (raw) => raw, null, "session", reportStorageFailure);
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

/** @template T @param {AbortSignal | undefined} signal @param {number} ms @param {(signal: AbortSignal) => Promise<T>} run */
async function withDeadline(signal, ms, run) {
  signal?.throwIfAborted();
  const ctl = new AbortController();
  const scope = createScope();
  let late = false;
  scope.timeout(() => { late = true; ctl.abort(); }, ms);
  if (signal) scope.listen(signal, "abort", () => ctl.abort(signal.reason), { once: true });
  try {
    const value = await run(ctl.signal);
    ctl.signal.throwIfAborted();
    return value;
  } catch (error) {
    signal?.throwIfAborted();
    if (late) throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    throw error;
  } finally {
    scope.dispose();
  }
}

/** @typedef {{ method?: string, body?: unknown, signal?: AbortSignal, query?: Record<string, unknown>, timeout?: number, headers?: Record<string, string> | null }} RequestOptions */

/** @param {string} path @param {RequestOptions} [opts] @returns {Promise<unknown>} */
export async function requestJson(path, { method = "GET", body, signal, query, timeout, headers = null } = {}) {
  let url = BASE + path;
  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null && v !== "") q.set(k, String(v));
    const qs = q.toString();
    if (qs) url += "?" + qs;
  }
  const ms = timeout ?? (method === "GET" ? READ_MS : WRITE_MS);
  return withDeadline(signal, ms, (active) => exchange(url, method, body, active, headers));
}

/** @param {string} path @param {RequestOptions} [options] @returns {Promise<ReturnType<typeof JSON.parse>>} */
export async function request(path, options) {
  if (path.split("?", 1)[0] === CHAT_STATUS_PATH) throw new TypeError("Use the checked chat status route.");
  return requestJson(path, options);
}

/** @param {string} url @param {string} method @param {unknown} [body] @param {AbortSignal} [signal] @param {Record<string, string> | null} [extra] @returns {Promise<unknown>} */
export async function exchange(url, method, body, signal, extra = null) {
  signal?.throwIfAborted();
  return fetchBody(url, {
    method,
    signal,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...coderHeaders(), ...(extra || {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    redirect: "manual",
  }, async (res) => {
    const raw = await res.text();
    signal?.throwIfAborted();
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new ApiError(res.status, "bad_answer", "XO's answer wasn't readable.");
    }
  });
}

/** @template T @param {string} url @param {RequestInit} init @param {(res: Response) => Promise<T>} readBody */
async function fetchBody(url, init, readBody) {
  const { signal } = init;
  signal?.throwIfAborted();
  try {
    const res = await fetch(url, init);
    signal?.throwIfAborted();
    if (res.type === "opaqueredirect") throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
    if (!res.ok) throw await failure(res, signal);
    const value = await readBody(res);
    signal?.throwIfAborted();
    return value;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ApiError || isAbort(error)) throw error;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
}

/** @param {unknown} err */
export const missingRoute = (err) => {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  return err.status === 405 || (err.status === 404 && (!("code" in err) || !err.code || err.code === "http_404"));
};

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isResponseObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** @param {unknown} error */
const isAbort = (error) => isResponseObject(error) && error.name === "AbortError";

/** The one error parser: storm's {detail: {code, message, …extras}}, FastAPI's 422 list, a plain-string detail, or serve.py's own. @param {number} status @param {string} statusText @param {string} raw */
function errorOf(status, statusText, raw) {
  /** @type {unknown} */
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (error) { if (!(error instanceof SyntaxError)) reportFailure(error); }
  const d = isResponseObject(data) ? data.detail : null;
  const detailCode = isResponseObject(d) && typeof d.code === "string" ? d.code : "";
  const responseCode = isResponseObject(data) && typeof data.error === "string" ? data.error : "";
  const code = detailCode || responseCode || `http_${status}`;
  let message = isResponseObject(d) && typeof d.message === "string" ? d.message : typeof d === "string" ? d : "";
  if (Array.isArray(d)) message = d.filter(isResponseObject).flatMap(({ loc, msg }) => {
    if (typeof msg !== "string" || !msg || !Array.isArray(loc)) return [];
    if (!loc.every((segment) => typeof segment === "string" || Number.isFinite(segment))) return [];
    return [`${loc.slice(1).join(".")}: ${msg}`];
  }).join("; ");
  if (!message) message = `${status} ${statusText || "error"}`;
  /** @type {Record<string, unknown>} */
  const extra = {};
  if (isResponseObject(d)) {
    for (const key of ["feature", "count", "sentence", "what", "confirm", "summary", "current"]) {
      if (Object.hasOwn(d, key)) extra[key] = d[key];
    }
  }
  return new ApiError(status, code, message, extra);
}

/** @param {Response} res @param {AbortSignal | null | undefined} signal */
const failure = async (res, signal) => {
  let raw = "";
  try { raw = await res.text(); }
  catch (error) {
    signal?.throwIfAborted();
    if (isAbort(error)) throw error;
    if (!(error instanceof TypeError)) reportFailure(error);
  }
  signal?.throwIfAborted();
  return errorOf(res.status, res.statusText, raw);
};

/** The page-relative URL of a route. @param {string} path */
export const urlOf = (path) => BASE + path;

/** The URL for what can't send headers (an <img>, an <iframe>): the token rides in the query, and serve.py takes it out. @param {string} path */
export function signedUrl(path) {
  if (!coderToken) return BASE + path;
  const url = new URL(BASE + path, "http://page/");
  url.searchParams.set(TOKEN_PARAM, coderToken);
  return url.pathname.slice(1) + url.search + url.hash;
}

/** The ws(s):// URL of a socket, relative to the page; the token rides in the query, which serve.py drops before the tunnel. @param {string} path */
export function socketUrl(path) {
  const url = new URL(BASE + path, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (coderToken) url.searchParams.set(TOKEN_PARAM, coderToken);
  return url.href;
}

/** A body read as text. @param {string} path @param {{ signal?: AbortSignal }} [opts] */
export async function text(path, { signal } = {}) {
  return withDeadline(signal, READ_MS, (active) =>
    fetchBody(BASE + path, { signal: active, headers: coderHeaders(), redirect: "manual" }, (res) => res.text()));
}

/** POST raw bytes with upload progress (XMLHttpRequest: fetch has none); an abort rejects with an AbortError. @param {string} path @param {Blob} body @param {{ onProgress?: (sent: number, total: number) => void }} [opts] */
export function upload(path, body, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  /** @type {Promise<unknown>} */
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
  return withDeadline(signal, ms, (active) =>
    fetchBody(BASE + path, { signal: active, headers: coderHeaders(), cache: "no-store", redirect: "manual" }, (res) => res.blob()));
}

/** A fresh id for a write that must never happen twice. */
export const clientId = () => `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
