// @ts-check

// XO Space's deploy API (services/launchpad/API.md); secrets travel once, in the POST's body, never kept, logged or put in a URL.
import { request, coderHeaders } from "../../core/platform/http.js";
import { readJsonEvents } from "../../core/platform/sse.js";
import { model, rows, hostOf } from "./model.js";

const enc = encodeURIComponent;

const END = new Set(["done", "error", "needs", "replaced"]);
/** How long a dropped stream waits before picking up again: Space's `retry: 3000` (a test may shorten it). */
export const RETRY = { ms: 3000 };
/** One run's events to its end: a drop is picked up where it stopped (/watch?run=&after=) five times at most; 204 means this viewer had the end. @param {string} p @param {string} path @param {RequestInit} init @param {(e: any) => void} on */
function stream(p, path, init, on) {
  const ctl = new AbortController(), take = rows(on);
  let run = "", seq = 0, ended = false, tries = 0;
  const seen = (/** @type {any} */ ev) => {
    if (ev.run_id && ev.run_id !== run) { run = ev.run_id; seq = 0; } // another run (Space started afresh): its own count
    if (ev.seq && ev.seq <= seq) return; // a resume that repeats what we had
    if (ev.seq) { seq = ev.seq; tries = 0; } // something new came: the next drop gets its five tries again
    if (END.has(ev.type)) ended = true;
    take(ev);
  };
  const fail = (/** @type {string} */ code, /** @type {string} */ message, action = "retry") => { ended = true; take({ type: "error", step: "check", code, message, action }); };
  const go = (/** @type {string} */ url, /** @type {RequestInit} */ req) => fetch(url, { ...req, signal: ctl.signal, headers: { Accept: "text/event-stream", ...(req.body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() }, cache: "no-store", redirect: "manual" })
    .then(async (res) => {
      // Space has no more for this viewer: the run ended, so the panel reads where the project stands instead of waiting
      if (res.status === 204) { ended = true; take({ type: "ended", run_id: run }); return; }
      if (!res.ok) { let d = null; try { d = (await res.json()).detail; } catch { /* not JSON */ } fail(d?.code || `http_${res.status}`, d?.message || `Space answered ${res.status}.`, d?.action || "retry"); return; }
      await readJsonEvents(res, seen, ctl.signal);
      again();
    })
    .catch((e) => { if (e.name !== "AbortError") again(e); });
  const again = (/** @type {any} */ e = undefined) => {
    if (ended || ctl.signal.aborted) return;
    // out of tries (or never told which run): the deploy goes on in Space; the panel says it lost touch
    if (!run || tries >= 5) { ended = true; take({ type: "lost", message: e?.message || "" }); return; }
    tries++;
    setTimeout(() => { if (!ctl.signal.aborted) go(`api/deploy/${enc(p)}/watch?run=${enc(run)}&after=${seq}`, { method: "GET" }); }, RETRY.ms);
  };
  go(path, init);
  return { stop: () => ctl.abort() };
}

/** project → its last check as Space sent it, for preflight to fill in (no second request). @type {Map<string, any>} */
const checks = new Map();
const real = {
  /** @param {string} p */
  check: async (p) => { const c = await request(`/deploy/${enc(p)}/check`); checks.set(p, c); return model(c); },
  /** preflight's network answers (admin, workflow, the app's state) on top of the last check. @param {string} p @param {string} [name] @returns {Promise<any>} */
  preflight: async (p, name) => {
    const pre = await request(`/deploy/${enc(p)}/preflight`, { query: { name } });
    const c = checks.get(p) || await real.check(p).then(() => checks.get(p));
    return model(c, pre);
  },
  /** @param {string} p @param {any} body @param {(e: any) => void} on */
  deploy: (p, body, on) => stream(p, `api/deploy/${enc(p)}`, { method: "POST", body: JSON.stringify(body) }, on),
  /** @param {string} p @param {(e: any) => void} on */
  watch: (p, on) => stream(p, `api/deploy/${enc(p)}/watch`, { method: "GET" }, on),
  /** @param {string} p */
  stop: (p) => request(`/deploy/${enc(p)}`, { method: "DELETE" }),
  /** @param {string} p */
  apps: async (p) => (await request(`/deploy/${enc(p)}/apps`)).apps.map((/** @type {any} */ a) => ({ id: a.id, name: a.name, status: a.status, host: hostOf(a.url), linkable: a.linkable !== false })),
  /** @param {string} p @param {string} app */
  link: async (p, app) => { const r = await request(`/deploy/${enc(p)}/link`, { method: "POST", body: { app } }); return { id: r.config?.app_id, name: r.config?.name, url: r.config?.url, host: hostOf(r.config?.url), status: r.app?.status || "" }; },
  /** @param {string} p */
  unlink: (p) => request(`/deploy/${enc(p)}/link`, { method: "DELETE" }),
  /** @param {string} p @param {string} note */
  askAgent: (p, note) => request(`/deploy/${enc(p)}/agent`, { method: "POST", body: note ? { note } : {} }),
  /** GitHub with `workflow`: a saved connection without it is dropped first; then Space imports this machine's gh login, else starts the device flow. @param {boolean} saved */
  async githubStart(saved) {
    if (saved) await request(`/connectors/github/disconnect`, { method: "POST", body: {} });
    const r = await request(`/connectors/github/cli/start`, { method: "POST", body: {} });
    if (r.status === "connected") return { connected: true, imported: !!r.imported, username: r.username || "" };
    return { id: r.session_id, code: r.user_code, url: r.verification_uri, until: Date.now() + (r.expires_in || 900) * 1000 };
  },
  /** @param {string} id */
  githubPoll: async (id) => { const r = await request(`/connectors/github/cli/poll`, { method: "POST", body: { session_id: id } }); return { done: r.status === "connected", failed: r.status === "failed" ? r.error || "GitHub said no." : "" }; },
  /** @param {string} id */
  githubCancel: (id) => request(`/connectors/github/cli/cancel`, { method: "POST", body: { session_id: id } }).catch(() => {}),
};

/** The deploy API (a function, so a test can hand the section another). */
export function createLpApi() { return real; }
