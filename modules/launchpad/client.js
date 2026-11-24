// @ts-check

import { request, coderHeaders } from "../../core/platform/http.js";
import { readJsonEvents } from "../../core/platform/sse.js";
import { model, rows, hostOf } from "./model.js";

/** @import { DeployFrame } from "./lifetime-types.d.ts" */
const enc = encodeURIComponent;

const END = new Set(["done", "error", "needs", "replaced"]);
/** How long a dropped stream waits before picking up again: Space's `retry: 3000` (a test may shorten it). */
export const RETRY = { ms: 3000 };
/** @param {string} p @param {string} path @param {RequestInit} init @param {(e: DeployFrame) => void} on */
function stream(p, path, init, on) {
  const ctl = new AbortController(), take = rows(on);
  let run = "", seq = 0, ended = false, tries = 0;
  const seen = (/** @type {unknown} */ ev) => {
    if (!ev || typeof ev !== "object" || !("type" in ev) || typeof ev.type !== "string") return;
    if ("run_id" in ev && typeof ev.run_id === "string" && ev.run_id && ev.run_id !== run) { run = ev.run_id; seq = 0; }
    if ("seq" in ev && typeof ev.seq === "number" && ev.seq) {
      if (ev.seq <= seq) return;
      seq = ev.seq; tries = 0;
    }
    if (END.has(ev.type)) ended = true;
    take(ev);
  };
  const fail = (/** @type {string} */ code, /** @type {string} */ message, action = "retry") => { ended = true; take({ type: "error", step: "check", code, message, action }); };
  const go = (/** @type {string} */ url, /** @type {RequestInit} */ req) => fetch(url, { ...req, signal: ctl.signal, headers: { Accept: "text/event-stream", ...(req.body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() }, cache: "no-store", redirect: "manual" })
    .then(async (res) => {
      // Space has no more for this viewer: the run ended, so the panel reads where the project stands instead of waiting
      if (res.status === 204) { ended = true; take({ type: "ended", run_id: run }); return; }
      if (!res.ok) {
        let d;
        try { d = (await res.json())?.detail; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
        fail(d?.code || `http_${res.status}`, d?.message || `Space answered ${res.status}.`, d?.action || "retry");
        return;
      }
      await readJsonEvents(res, seen, ctl.signal);
      again();
    })
    .catch((error) => { if (!(error instanceof Error && error.name === "AbortError")) again(error); });
  const again = (/** @type {unknown} */ e = undefined) => {
    if (ended || ctl.signal.aborted) return;
    // out of tries (or never told which run): the deploy goes on in Space; the panel says it lost touch
    if (!run || tries >= 5) { ended = true; take({ type: "lost", message: e instanceof Error ? e.message : "" }); return; }
    tries++;
    setTimeout(() => { if (!ctl.signal.aborted) go(`api/deploy/${enc(p)}/watch?run=${enc(run)}&after=${seq}`, { method: "GET" }); }, RETRY.ms);
  };
  go(path, init);
  return { stop: () => ctl.abort() };
}

/** @type {Map<string, object>} */
const checks = new Map();
const real = {
  /** @param {string} p */
  check: async (p) => { const c = await request(`/deploy/${enc(p)}/check`); checks.set(p, c); return model(c); },
  /** @param {string} p @param {string} [name] */
  preflight: async (p, name) => {
    const pre = await request(`/deploy/${enc(p)}/preflight`, { query: { name } });
    const c = checks.get(p) || await real.check(p).then(() => checks.get(p));
    return model(c, pre);
  },
  /** @param {string} p @param {object} body @param {(e: DeployFrame) => void} on */
  deploy: (p, body, on) => stream(p, `api/deploy/${enc(p)}`, { method: "POST", body: JSON.stringify(body) }, on),
  /** @param {string} p @param {(e: DeployFrame) => void} on */
  watch: (p, on) => stream(p, `api/deploy/${enc(p)}/watch`, { method: "GET" }, on),
  /** @param {string} p */
  stop: (p) => request(`/deploy/${enc(p)}`, { method: "DELETE" }),
  /** @param {string} p @param {AbortSignal} [signal] */
  apps: async (p, signal) => (await request(`/deploy/${enc(p)}/apps`, { signal })).apps.map(
    (/** @type {{id: string, name: string, status: string, url: string, linkable?: boolean}} */ a) =>
      ({ id: a.id, name: a.name, status: a.status, host: hostOf(a.url), linkable: a.linkable !== false })),
  /** @param {string} p @param {string} app */
  link: async (p, app) => { const r = await request(`/deploy/${enc(p)}/link`, { method: "POST", body: { app } }); return { id: r.config?.app_id, name: r.config?.name, url: r.config?.url, host: hostOf(r.config?.url), status: r.app?.status || "" }; },
  /** @param {string} p */
  unlink: (p) => request(`/deploy/${enc(p)}/link`, { method: "DELETE" }),
  /** @param {string} p @param {string} note */
  askAgent: (p, note) => request(`/deploy/${enc(p)}/agent`, { method: "POST", body: note ? { note } : {} }),
  /** @param {boolean} saved @param {AbortSignal} [signal] */
  async githubStart(saved, signal) {
    if (saved) await request(`/connectors/github/disconnect`, { method: "POST", body: {}, signal });
    signal?.throwIfAborted();
    const r = await request(`/connectors/github/cli/start`, { method: "POST", body: {}, signal });
    if (r.status === "connected") return { connected: true, imported: !!r.imported, username: r.username || "" };
    return { id: r.session_id, code: r.user_code, url: r.verification_uri, until: Date.now() + (r.expires_in || 900) * 1000 };
  },
  /** @param {string} id @param {AbortSignal} [signal] */
  githubPoll: async (id, signal) => {
    const r = await request(`/connectors/github/cli/poll`, { method: "POST", body: { session_id: id }, signal });
    return { done: r.status === "connected", failed: r.status === "failed" ? r.error || "GitHub said no." : "" };
  },
  /** @param {string} id */
  githubCancel: (id) => request(`/connectors/github/cli/cancel`, { method: "POST", body: { session_id: id } }).catch(() => {}),
};

/** The deploy API (a function, so a test can hand the section another). */
export function createLpApi() { return real; }
