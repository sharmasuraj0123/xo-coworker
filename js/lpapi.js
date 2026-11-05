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
const NODE = { check: "repo", credentials: "repo", repo: "repo", app: "repo", prepare: "repo", push: "repo", create: "repo", env: "repo", build: "build", release: "release", url: "live" };
const ROWS = ["repo", "build", "release", "live"];
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
    github: { connected: pre ? !!pre.github?.connected : !!c.prerequisites?.github_connected, workflow: pre ? pre.github?.workflow_scope !== false : true, login: pre?.github?.login || "" },
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
function rows(on) {
  const open = new Set(), shut = new Set(), said = {};
  const close = (upto) => { for (const n of ROWS) { if (n === upto) break; if (open.has(n) && !shut.has(n)) { shut.add(n); on({ step: n, state: "done", text: said[n] }); } } };
  return (ev) => {
    const n = NODE[ev.step] || "repo";
    switch (ev.type) {
      case "step":
        if (ev.status === "running" || ev.status === "waiting") { close(n); open.add(n); said[n] = ev.message || ev.title || said[n]; on({ step: n, state: "doing", text: said[n] }); }
        else if (ev.status === "done" || ev.status === "skipped") { if (ev.message) said[n] = ev.message; if (n !== "repo") { shut.add(n); on({ step: n, state: "done", text: said[n] }); } else if (open.has(n)) on({ step: n, state: "doing", text: said[n] }); }
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
        on({ step: n, state: "failed", text: ev.message, error: { code: ev.code, message: ev.message, fix: ev.fix, step: d.failed_step, log: Array.isArray(d.log_tail) ? d.log_tail.slice(-3) : null, url: d.run_url, port: d.port, declared: (d.exposed_ports || [])[0], kind: d.kind, release: d.release, diagnosis: d.diagnosis } });
        return;
      }
      case "needs": on({ type: "needs", step: n, code: ev.code, message: ev.message, fix: ev.fix, options: ev.options || [], data: ev.data || {} }); return;
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
function stream(path, init, on) {
  const ctl = new AbortController(), take = rows(on);
  fetch(path, { ...init, signal: ctl.signal, headers: { Accept: "text/event-stream", ...(init.body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() }, cache: "no-store", redirect: "manual" })
    .then(async (res) => {
      if (!res.ok) { let d = null; try { d = (await res.json()).detail; } catch { /* not JSON */ } throw new ApiError(res.status, d?.code || `http_${res.status}`, d?.message || `${res.status}`); }
      await sse(res, take, ctl.signal);
    })
    .catch((e) => { if (e.name !== "AbortError") take({ type: "error", step: "check", code: e.code || "network", message: e.message }); });
  return { stop: () => ctl.abort() };
}

const real = {
  check: async (p) => model(await request(`/deploy/${enc(p)}/check`)),
  /** check and preflight together: the network's answers (admin, workflow, the app's state) in the model. */
  preflight: async (p, name) => { const [c, pre] = await Promise.all([request(`/deploy/${enc(p)}/check`), request(`/deploy/${enc(p)}/preflight`, { query: { name } })]); return model(c, pre); },
  deploy: (p, body, on) => stream(`api/deploy/${enc(p)}`, { method: "POST", body: JSON.stringify(body) }, on),
  watch: (p, on) => stream(`api/deploy/${enc(p)}/watch`, { method: "GET" }, on),
  stop: (p) => request(`/deploy/${enc(p)}`, { method: "DELETE" }),
  apps: async (p) => (await request(`/deploy/${enc(p)}/apps`)).apps.map((a) => ({ id: a.id, name: a.name, status: a.status, host: hostOf(a.url), linkable: a.linkable !== false })),
  link: async (p, app) => { const r = await request(`/deploy/${enc(p)}/link`, { method: "POST", body: { app } }); return { id: r.config?.app_id, name: r.config?.name, url: r.config?.url, host: hostOf(r.config?.url), status: r.app?.status || "" }; },
  unlink: (p) => request(`/deploy/${enc(p)}/link`, { method: "DELETE" }),
  askAgent: (p, note) => request(`/deploy/${enc(p)}/agent`, { method: "POST", body: note ? { note } : {} }),
  // GitHub, again with `workflow`: disconnect a connection that lacks it, then the device flow
  async githubStart(connected) {
    if (connected) await request(`/connectors/github/disconnect`, { method: "POST", body: {} });
    const r = await request(`/connectors/github/cli/start`, { method: "POST", body: {} });
    return { id: r.session_id, code: r.user_code, url: r.verification_uri, until: Date.now() + (r.expires_in || 900) * 1000 };
  },
  githubPoll: async (id) => { const r = await request(`/connectors/github/cli/poll`, { method: "POST", body: { session_id: id } }); return { done: r.status === "connected", failed: r.status === "failed" ? r.error || "GitHub said no." : "" }; },
  githubCancel: (id) => request(`/connectors/github/cli/cancel`, { method: "POST", body: { session_id: id } }).catch(() => {}),
};

/** The API, or (only where localStorage "xo-lp-demo" names a scenario) the preview's scripted one. */
export function createLpApi() {
  let demo = null;
  try { demo = localStorage.getItem("xo-lp-demo"); } catch { /* private mode */ }
  if (!demo) return real;
  const fake = import("./lpfake.js").then((m) => m.fakeApi(demo));
  const api = {};
  fake.then((f) => { api.sc = f.sc; });
  for (const k of Object.keys(real)) {
    api[k] = k === "deploy" || k === "watch"
      ? (p, body, on) => { let h = null, off = false; fake.then((f) => { if (!off && f[k]) h = f[k](p, body, on); }); return { stop() { off = true; h && h.stop(); } }; }
      : async (...a) => { const f = await fake; return f[k] ? f[k](...a) : null; };
  }
  return api;
}
