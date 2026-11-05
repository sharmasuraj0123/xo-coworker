// XO Space's deploy API, for js/launchpad.js. The contract is xo-space's services/launchpad/API.md
// (5 November); flow.json, served at GET /api/deploy/flow, has the steps' titles and every error's words.
//
//   GET    /api/deploy/{p}/check       state and the filled-in form; files only, milliseconds
//   GET    /api/deploy/{p}/preflight   what a deploy would meet on GitHub and Launchpad; 1–3 s
//   POST   /api/deploy/{p}             deploys; Server-Sent Events, ending in done, error or needs
//   DELETE /api/deploy/{p}             stops the running deploy
//   GET    /api/deploy/{p}/watch       follows a running deploy (or the latest build and release)
//   GET    /api/deploy/{p}/apps, POST/DELETE …/link, POST …/agent
//   POST   /api/connectors/github/cli/{start,poll,cancel}, …/disconnect: the device flow, with `workflow`
//
// This file turns the contract into the few things the section draws: one model per project, and four
// rows' worth of events (repo, build, release, live) out of Space's eleven steps. Secrets travel once, in
// the POST's body; nothing here keeps, logs or puts them in a URL.

import { request, coderHeaders, ApiError } from "./api.js";

const enc = encodeURIComponent;

/** Space's eleven steps onto the card's four rows: everything before the build is the repository's row. */
/** What the panel offers for an error or a decision: Space's `action` (flow.json `actions`) as [label, what the
 *  panel does]. null for what the person does outside the panel (sign in, reinstall, pull, …): Space's message and
 *  fix are the answer, with no lit button. An action this list doesn't know (or none sent) offers Try again. */
const NEXT = {
  connect_github: ["Connect GitHub", "reconnect"], reconnect_github: ["Reconnect GitHub", "reconnect"],
  ask_agent: ["Ask an agent", "ask-fix"], retry: ["Try again", "retry"], deploy: ["Deploy", "retry"],
  watch: ["Follow it again", "rewatch"], edit_settings: ["Change the settings", "settings"],
  create_repo: ["Create the private repo", "create-repo"], rename_repo: ["Pick another name", "settings"],
  link: ["Link it", "link-same"], recreate_or_unlink: ["Create it again", "recreate"], unlink: ["Unlink", "unlink"], pick_app: ["Pick an app", "pick"],
  open_build_log: ["Open the build log", "log"],
};
const OUTSIDE = new Set(["manual", "none", "sign_in_xo", "reinstall_space", "pull_changes"]);
export function nextStep(action) { return OUTSIDE.has(action) ? null : NEXT[action] || NEXT.retry; }

/** Everything the deploy form draws from the model, and from the panel's own state in `extra`, but not what's typed
 *  (the form keeps that as you type): the form is redrawn exactly when this changes. Leaving one out kept a stale
 *  form, e.g. "Connect GitHub" after GitHub had connected (Astra, 3920c92). */
export function formKey(c, extra = {}) {
  return JSON.stringify([c.state, c.repo, c.github, c.portFrom, c.portSure, c.env, c.blockers, c.warnings, c.app && c.app.id, extra]);
}

const NODE = { check: "repo", credentials: "repo", repo: "repo", app: "repo", prepare: "repo", push: "repo", create: "repo", env: "repo", build: "build", release: "release", url: "live" };
const ROWS = ["repo", "build", "release", "live"];
/** A Launchpad app's status, in words and a tone: what's wrong is read first ("unhealthy" holds "healthy"),
 *  then stopped, then moving, then serving (anchored). */
export const appState = (st) => /fail|crash|error|unhealthy|degraded/i.test(st) ? ["stop", "Didn't go live"] : /stop|paus|sleep|suspend/i.test(st) ? ["", "Stopped"] : /progress|deploy|roll|start|build|pending|creat/i.test(st) ? ["work", "Rolling out"] : /^(run|ready|live|healthy|serving|up|active)/i.test(st) ? ["go", "Live"] : ["", String(st || "Unknown").replace(/^./, (x) => x.toUpperCase())];
const hostOf = (url) => { try { return new URL(url).host; } catch { return url || ""; } };

/** check (and, once it's in, preflight) as the section's model. */
export function model(c, pre = null) {
  const f = c.fields || {}, cfg = c.config, app = pre?.launchpad?.app;
  const repo = pre?.repo || {};
  return {
    project: c.project, state: c.state, summary: c.summary || "",
    name: f.name?.value || c.project, port: f.port?.value ?? null, portFrom: f.port?.source || "", portSure: f.port?.confident !== false,
    env: (f.env || []).map((x) => ({ name: x.name, sensitive: !!x.sensitive, source: x.source || "", default: x.default || "", set: !!pre?.launchpad?.env_set?.[x.name] })),
    repo: {
      full: repo.full_name || f.repo?.full_name || f.repo?.origin || "",
      branch: f.repo?.branch || c.git?.branch || "main",
      // until preflight answers, an origin is taken as usable; preflight's "new" says otherwise
      admin: pre ? repo.mode !== "new" : !!(f.repo?.origin || f.repo?.full_name),
      create: f.repo?.new_repo_name || c.project, why: repo.reason || "", taken: !!repo.exists,
    },
    github: { connected: pre ? !!pre.github?.connected : !!c.prerequisites?.github_connected, workflow: pre ? pre.github?.workflow_scope !== false : true, login: pre?.github?.login || "", source: pre?.github?.source || c.prerequisites?.github_source || null, fix: pre?.github?.fix || "" },
    app: cfg?.app_id ? { id: cfg.app_id, name: cfg.name, url: cfg.url, host: hostOf(cfg.url), status: app?.status || "", release: app?.release || null, at: app?.last_deploy_at ? Date.parse(app.last_deploy_at) : null, ready: app?.ready, of: app?.desired, gone: app?.exists === false, commit: (c.git?.deployed_head || "").slice(0, 7) } : null,
    nameFree: pre?.launchpad?.name_free !== false, sameName: pre?.launchpad?.same_name || null,
    missing: (c.reasons || []).map((r) => ({ what: typeof r === "string" ? r : r.what || r.message || "", why: typeof r === "string" ? "" : r.why || "", ok: false })),
    reason: c.summary || "", blockers: c.blockers || [], warnings: c.warnings || [],
    behind: c.git?.head && c.git?.deployed_head && c.git.head !== c.git.deployed_head,
    running: c.running?.kind === "deploy" ? c.running.run_id : null,
    pre: !!pre,
  };
}

/** One stream's events as the card's: a row opens when its first step runs and closes when a later row's
 *  step starts (or its own last step ends); progress fills in the build's link and the release's n of m. */
export function rows(on) {
  const open = new Set(), shut = new Set(), said = {};
  let pushed = ""; // the repository row ends on what the push did, not on the last setup step's words
  const close = (upto) => { for (const n of ROWS) { if (n === upto) break; if (open.has(n) && !shut.has(n)) { shut.add(n); on({ step: n, state: "done", text: n === "repo" && pushed ? pushed : said[n] }); } } };
  const raw = on;
  on = (e) => raw({ ...e, at: stamp });
  let stamp = 0;
  return (ev) => {
    stamp = Date.parse(ev.ts) || Date.now();
    if (ev.type === "run") { raw({ type: "run", started: Date.parse(ev.started_at) || stamp, at: stamp }); return; }
    const n = NODE[ev.step] || "repo";
    switch (ev.type) {
      case "step":
        if (ev.status === "running" || ev.status === "waiting") { close(n); open.add(n); said[n] = ev.message || ev.title || said[n]; on({ step: n, state: "doing", text: said[n] }); }
        else if (ev.status === "done" || ev.status === "skipped") { if (ev.message) said[n] = ev.message; if (ev.step === "push" && ev.message) pushed = ev.message; if (n !== "repo") { shut.add(n); on({ step: n, state: "done", text: said[n] }); } else if (open.has(n)) on({ step: n, state: "doing", text: said[n] }); }
        return;
      case "progress": {
        const d = ev.data || {};
        if (n === "build") on({ step: "build", state: "doing", text: ev.message || said.build, url: d.run_url });
        else if (n === "release") on({ step: "release", state: "doing", text: ev.message || said.release, ready: d.ready, of: d.desired, release: d.release });
        return;
      }
      case "done": close("live"); on({ step: "live", state: "done", text: "Live", host: hostOf(ev.url), url: ev.url, release: ev.release, commit: (ev.commit || "").slice(0, 7) }); return;
      case "error": {
        const d = ev.data || {};
        on({ step: n, state: "failed", text: ev.message, error: { code: ev.code, action: ev.action || "", message: ev.message, fix: ev.fix, source: d.source, app: d.app, step: d.failed_step, log: Array.isArray(d.log_tail) ? d.log_tail.slice(-3) : null, url: d.run_url, port: d.port, declared: (d.exposed_ports || [])[0], kind: d.kind, release: d.release, diagnosis: d.diagnosis } });
        return;
      }
      case "needs": on({ type: "needs", step: n, code: ev.code, action: ev.action || "", message: ev.message, fix: ev.fix, options: ev.options || [], data: ev.data || {} }); return;
      case "replaced": on({ type: "replaced", by: ev.by || {} }); return;
      case "ended": on({ type: "ended", run: ev.run_id || "" }); return;
      case "lost": on({ type: "lost", message: ev.message || "" }); return;
      case "warning": on({ type: "warning", message: ev.message }); return;
    }
  };
}

/** A Server-Sent Events body, read as it arrives: each event's JSON to `on`. */
async function sse(res, on, signal) {
  const rd = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await rd.read();
    if (done || signal.aborted) return;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (data) { try { on(JSON.parse(data)); } catch { /* a ping or a line that isn't JSON */ } }
    }
  }
}
const END = new Set(["done", "error", "needs", "replaced"]);
/** How long a dropped stream waits before picking up again: Space's `retry: 3000` (a test may shorten it). */
export const RETRY = { ms: 3000 };
/** One run's events, followed to its end. A stream that drops before done, error, needs or replaced is picked up
 *  where it stopped (GET /watch?run=&after=, after Space's 3 s retry), five times at most; a 204 means this viewer
 *  already had the end. An answer that isn't a stream (an HTTP error) ends it with Space's code and action. */
function stream(p, path, init, on) {
  const ctl = new AbortController(), take = rows(on);
  let run = "", seq = 0, ended = false, tries = 0;
  const seen = (ev) => {
    if (ev.run_id && ev.run_id !== run) { run = ev.run_id; seq = 0; } // another run (Space started afresh): its own count
    if (ev.seq && ev.seq <= seq) return; // a resume that repeats what we had
    if (ev.seq) { seq = ev.seq; tries = 0; } // something new came: the next drop gets its five tries again
    if (END.has(ev.type)) ended = true;
    take(ev);
  };
  const fail = (code, message, action = "retry") => { ended = true; take({ type: "error", step: "check", code, message, action }); };
  const go = (url, req) => fetch(url, { ...req, signal: ctl.signal, headers: { Accept: "text/event-stream", ...(req.body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() }, cache: "no-store", redirect: "manual" })
    .then(async (res) => {
      // Space has no more for this viewer: the run ended (its outcome may have been lost in the drop), so the panel
      // reads where the project stands instead of waiting on a run that's over
      if (res.status === 204) { ended = true; take({ type: "ended", run_id: run }); return; }
      if (!res.ok) { let d = null; try { d = (await res.json()).detail; } catch { /* not JSON */ } fail(d?.code || `http_${res.status}`, d?.message || `Space answered ${res.status}.`, d?.action || "retry"); return; }
      await sse(res, seen, ctl.signal);
      again();
    })
    .catch((e) => { if (e.name !== "AbortError") again(e); });
  const again = (e) => {
    if (ended || ctl.signal.aborted) return;
    // out of tries (or never told which run): the deploy goes on in Space; the panel says it lost touch
    if (!run || tries >= 5) { ended = true; take({ type: "lost", message: e?.message || "" }); return; }
    tries++;
    setTimeout(() => { if (!ctl.signal.aborted) go(`api/deploy/${enc(p)}/watch?run=${enc(run)}&after=${seq}`, { method: "GET" }); }, RETRY.ms);
  };
  go(path, init);
  return { stop: () => ctl.abort() };
}

const checks = new Map(); // project → its last check as Space sent it, for preflight to fill in (no second request)
const real = {
  check: async (p) => { const c = await request(`/deploy/${enc(p)}/check`); checks.set(p, c); return model(c); },
  /** preflight's network answers (admin, workflow, the app's state) on top of the last check. */
  preflight: async (p, name) => {
    const pre = await request(`/deploy/${enc(p)}/preflight`, { query: { name } });
    const c = checks.get(p) || await real.check(p).then(() => checks.get(p));
    return model(c, pre);
  },
  deploy: (p, body, on) => stream(p, `api/deploy/${enc(p)}`, { method: "POST", body: JSON.stringify(body) }, on),
  watch: (p, on) => stream(p, `api/deploy/${enc(p)}/watch`, { method: "GET" }, on),
  stop: (p) => request(`/deploy/${enc(p)}`, { method: "DELETE" }),
  apps: async (p) => (await request(`/deploy/${enc(p)}/apps`)).apps.map((a) => ({ id: a.id, name: a.name, status: a.status, host: hostOf(a.url), linkable: a.linkable !== false })),
  link: async (p, app) => { const r = await request(`/deploy/${enc(p)}/link`, { method: "POST", body: { app } }); return { id: r.config?.app_id, name: r.config?.name, url: r.config?.url, host: hostOf(r.config?.url), status: r.app?.status || "" }; },
  unlink: (p) => request(`/deploy/${enc(p)}/link`, { method: "DELETE" }),
  askAgent: (p, note) => request(`/deploy/${enc(p)}/agent`, { method: "POST", body: note ? { note } : {} }),
  // GitHub with `workflow`. A saved connection without it is dropped first (a gh login isn't ours to drop); then
  // Space imports this machine's gh login when it's usable (connected at once, no code), else starts the device flow
  async githubStart(saved) {
    if (saved) await request(`/connectors/github/disconnect`, { method: "POST", body: {} });
    const r = await request(`/connectors/github/cli/start`, { method: "POST", body: {} });
    if (r.status === "connected") return { connected: true, imported: !!r.imported, username: r.username || "" };
    return { id: r.session_id, code: r.user_code, url: r.verification_uri, until: Date.now() + (r.expires_in || 900) * 1000 };
  },
  githubPoll: async (id) => { const r = await request(`/connectors/github/cli/poll`, { method: "POST", body: { session_id: id } }); return { done: r.status === "connected", failed: r.status === "failed" ? r.error || "GitHub said no." : "" }; },
  githubCancel: (id) => request(`/connectors/github/cli/cancel`, { method: "POST", body: { session_id: id } }).catch(() => {}),
};

/** The deploy API (a function, so a test can hand the section another). */
export function createLpApi() { return real; }
