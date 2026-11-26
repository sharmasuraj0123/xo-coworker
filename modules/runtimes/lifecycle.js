// @ts-check
import { ApiError, missingRoute } from "../../core/platform/http.js";
import { rtName } from "../../core/services/runtimes.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { PASTE, REMOTE, deviceCode } from "./rows.js";

/** @import { Flow, JobView, Remote, LifecycleDeps } from "./lifecycle-types" */

/** @import { Job, JobAction } from "../../core/platform/lifecycle-types" */

/** @import { SignInEvent } from "../../core/platform/sign-in-types" */

/** @import { Runtime } from "../../core/services/runtime-types" */

const JOB_POLL_MS = 1000;
/** @type {Record<string, string>} */
const DONE = { install: "installed", update: "updated", uninstall: "uninstalled", sign_out: "signed out" };
const RUNS = ["installing", "updating", "uninstalling", "failed"];

/** @typedef {LifecycleDeps & { notify: () => void, errs: Map<string, string> }} Part */

/** One sign-in per runtime, its CLI's frames turned into what the row shows. @param {Part} p */
function signIns({ api, refresh, announce, scope, notify, errs }) {
  /** @type {Map<string, Flow>} */
  const flows = new Map();
  const { signal } = scope;
  scope.effect(() => () => { for (const f of flows.values()) f.ctl.abort(); flows.clear(); });
  /** @param {string} name @param {Flow} f @param {(ok: boolean, words: string) => void} end @returns {(ev: SignInEvent) => void} */
  const frames = (name, f, end) => (ev) => {
    if (ev.type === "session") f.session = ev.session_id;
    else if (ev.type === "auth_url") {
      f.url = ev.url;
      const d = PASTE.has(name) ? null : deviceCode(f.lines, f.url);
      if (f.phase === "starting") f.phase = PASTE.has(name) ? "paste" : d ? "code" : "link";
      if (d && f.phase !== "code") f.phase = "code";
      if (d) f.code = d.code;
      notify();
    } else if (ev.type === "stdout" && !PASTE.has(name) && f.phase !== "code") {
      f.lines.push(ev.line || "");
      const d = deviceCode(f.lines, f.url || null);
      if (d) { f.phase = "code"; f.url = d.url; f.code = d.code; notify(); }
    } else if (ev.type === "done") {
      const said = f.url || f.code ? `${rtName(name)} signed in.` : `${rtName(name)} is already signed in.`;
      end(ev.returncode === 0, ev.returncode === 0 ? said : `${rtName(name)}'s sign-in ended without signing in (exit ${ev.returncode}).`);
    } else if (ev.type === "error") {
      end(false, ev.code === "not_installed" ? `${rtName(name)} isn't installed. Install it first.` : ev.message || ev.error);
    }
  };
  /** @param {string} name */
  async function signIn(name) {
    if (flows.has(name) || signal.aborted) return;
    /** @type {Flow} */
    const f = { phase: "starting", ctl: new AbortController(), lines: [] };
    flows.set(name, f); errs.delete(name); notify();
    const mine = () => !signal.aborted && flows.get(name) === f;
    let ended = false;
    /** @param {boolean} ok @param {string} words */
    const end = (ok, words) => {
      if (ended || !mine()) return;
      ended = true; flows.delete(name); f.ctl.abort();
      if (ok) announce(words); else errs.set(name, words);
      notify(); refresh();
    };
    const on = frames(name, f, end);
    try {
      await api.signInStream(name, { signal: f.ctl.signal, on: (ev) => { if (mine()) on(ev); } });
      end(false, `${rtName(name)}'s sign-in stopped before it finished. Sign in to try again.`);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (mine() && !aborted) end(false, requestFailureMessage(err, `${rtName(name)}'s sign-in didn't start.`));
    }
  }
  /** @param {string} name */
  function cancelSignIn(name) {
    const f = flows.get(name);
    if (!f) return;
    flows.delete(name); f.ctl.abort(); errs.delete(name); notify();
    void api.signInCancel(name).catch((error) => {
      if (!missingRoute(error)) errs.set(name, requestFailureMessage(error, "Couldn't cancel the sign-in."));
      notify();
    });
  }
  /** @param {string} name @param {string} code */
  async function sendCode(name, code) {
    const f = flows.get(name);
    if (!f || f.phase !== "paste" || !code || !f.session) return;
    f.phase = "sending"; errs.delete(name); notify();
    try { await api.signInCode(name, f.session, code); }
    catch (error) {
      if (signal.aborted || flows.get(name) !== f) return;
      f.phase = "paste"; errs.set(name, requestFailureMessage(error, "Couldn't send the sign-in code.")); notify();
    }
  }
  /** @param {string} name */
  const opened = (name) => { const f = flows.get(name); if (f && !f.opened) { f.opened = true; notify(); } };
  return { flows, signIn, cancelSignIn, sendCode, opened };
}

/** @param {Job} j @param {number | undefined} at @param {boolean} live whether it ended just now @returns {JobView} */
function viewOf(j, at, live = true) {
  const r = j.result || {}, ended = j.status !== "running";
  return { id: j.id, action: j.action, status: j.status, log: j.log, at, end: ended && live ? Date.now() : undefined,
    error: j.status === "failed" ? r.message || r.error || "" : undefined };
}

/** One job per runtime: started here or found running, read once a second until it ends; a failure stays until the next. @param {Part} p */
function jobsOf({ api, refresh, announce, scope, notify, errs }) {
  /** @type {Map<string, JobView>} */
  const jobs = new Map();
  const { signal } = scope;
  /** @param {string} name @param {string} id */
  const ours = (name, id) => !signal.aborted && jobs.get(name)?.id === id;
  /** @param {string} name @param {string} id */
  function follow(name, id) {
    const tick = async () => {
      if (!ours(name, id) || jobs.get(name)?.status !== "running") return;
      try {
        const j = await api.runtimeJob(name, id, { signal });
        const now = jobs.get(name);
        if (!ours(name, id) || !now) return;
        jobs.set(name, { ...viewOf(j, now.at), open: now.open });
        if (j.status === "running") { notify(); scope.timeout(tick, JOB_POLL_MS); return; }
        if (j.status === "done") announce(`${rtName(name)} ${DONE[j.action] || "done"}.`);
        notify(); refresh();
      } catch (error) {
        const now = jobs.get(name);
        if (!ours(name, id) || !now) return;
        if (!(error instanceof ApiError && error.code === "unknown_job")) { scope.timeout(tick, JOB_POLL_MS * 3); return; }
        jobs.set(name, { ...now, status: "failed", lost: true, end: Date.now() }); notify(); refresh();
      }
    };
    scope.timeout(tick, JOB_POLL_MS);
  }
  /** A job the Space names that this page didn't start: read it, and follow it while it runs. @param {string} name @param {string} id */
  async function adopt(name, id, failed = false) {
    if (jobs.get(name)?.id === id || signal.aborted) return;
    jobs.set(name, { id, action: "", status: failed ? "failed" : "running", log: [] });
    try {
      const j = await api.runtimeJob(name, id, { signal });
      if (!ours(name, id)) return;
      jobs.set(name, viewOf(j, undefined, false));
      if (j.status === "running") follow(name, id);
    } catch (error) {
      if (!ours(name, id)) return;
      jobs.set(name, { id, action: "", status: "failed", log: [], lost: error instanceof ApiError && error.code === "unknown_job" });
    }
    notify();
  }
  /** An uninstall that sessions run on returns those sessions unless forced. @param {string} name @param {JobAction} action */
  async function run(name, action, { force = false } = {}) {
    if (signal.aborted || jobs.get(name)?.status === "running") return null;
    errs.delete(name);
    jobs.set(name, { action, status: "running", log: [], at: Date.now() }); notify();
    try {
      const j = await api.runtimeAction(name, action, { force });
      if (signal.aborted) return null;
      jobs.set(name, viewOf(j, Date.now())); notify(); follow(name, j.id); refresh();
    } catch (error) {
      if (signal.aborted) return null;
      jobs.delete(name);
      const e = /** @type {ApiError & { sessions?: unknown, job?: unknown }} */ (error);
      const sessions = e instanceof ApiError && e.code === "runtime_in_use" && Array.isArray(e.sessions) ? e.sessions : null;
      if (sessions) { notify(); return { inUse: sessions.filter((s) => typeof s === "string") }; }
      if (e instanceof ApiError && e.code === "job_running" && typeof e.job === "string") { void adopt(name, e.job); return null; }
      errs.set(name, requestFailureMessage(error, `Couldn't start the ${action.replace("_", " ")}.`)); notify();
    }
    return null;
  }
  /** @param {Runtime[] | null | undefined} rts */
  function sync(rts) {
    for (const rt of rts || []) {
      const lc = rt.lifecycle;
      if (lc && lc.job && RUNS.includes(lc.state)) void adopt(rt.name, lc.job, lc.state === "failed");
    }
  }
  /** @param {string} name */
  const toggleLog = (name) => { const j = jobs.get(name); if (j) { j.open = !j.open; notify(); } };
  /** @param {string} name */
  const retry = (name) => {
    const a = jobs.get(name)?.action;
    if (a && a in DONE) void run(name, /** @type {JobAction} */ (a));
  };
  return { jobs, run, retry, sync, toggleLog };
}

/** Remote control for the runtimes that have one. @param {Part} p */
function remotesOf({ api, announce, scope, notify }) {
  /** @type {Map<string, Remote>} */
  const remotes = new Map();
  const { signal } = scope;
  /** @param {{ running?: boolean, session_url?: string | null, error?: string | null, detail?: string | null }} s @returns {Remote} */
  const of = (s) => ({ running: !!s.running, url: s.session_url || null, error: s.error ? s.detail || s.error : null });
  /** @param {Runtime[] | null | undefined} rts */
  async function readRemotes(rts) {
    await Promise.all((rts || []).filter((r) => REMOTE.has(r.name) && r.lifecycle?.signed_in).map(async (r) => {
      try {
        const s = await api.remoteControl(r.name, { signal });
        if (!signal.aborted) remotes.set(r.name, of(s));
      } catch (error) {
        if (signal.aborted) return;
        const none = missingRoute(error) || (error instanceof ApiError && (error.status === 501 || error.code === "unsupported"));
        if (none) remotes.delete(r.name);
        else remotes.set(r.name, { error: requestFailureMessage(error, "Couldn't read remote control.") });
      }
    }));
    notify();
  }
  /** @param {string} name @param {boolean} on */
  async function setRemote(name, on) {
    const was = remotes.get(name) || {};
    if (was.busy) return;
    remotes.set(name, { ...was, busy: true }); notify();
    try {
      const s = await api.setRemoteControl(name, on);
      if (signal.aborted) return;
      remotes.set(name, of(s));
      announce(`${rtName(name)}'s remote control is ${s.running ? "on" : "off"}.`);
    } catch (error) {
      const words = requestFailureMessage(error, "Couldn't change remote control.");
      if (!signal.aborted) remotes.set(name, { ...was, busy: false, error: words });
    }
    notify();
  }
  return { remotes, readRemotes, setRemote };
}

/** Sign-ins, jobs and remote control per runtime, for the app's life, so leaving Settings keeps them. @param {LifecycleDeps} deps */
export function createLifecycle(deps) {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  const notify = () => { if (!deps.scope.signal.aborted) for (const fn of [...listeners]) fn(); };
  deps.scope.effect(() => () => listeners.clear());
  const part = { ...deps, notify, errs: new Map() };
  const s = signIns(part), j = jobsOf(part), r = remotesOf(part);
  return {
    signIn: s.signIn, cancelSignIn: s.cancelSignIn, sendCode: s.sendCode, opened: s.opened,
    run: j.run, retry: j.retry, sync: j.sync, toggleLog: j.toggleLog, readRemotes: r.readRemotes, setRemote: r.setRemote,
    flow: (name = "") => s.flows.get(name) || null,
    job: (name = "") => j.jobs.get(name) || null,
    err: (name = "") => part.errs.get(name) || "",
    remote: (name = "") => r.remotes.get(name) || null,
    /** @param {() => void} fn */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
