// Space's deploy routes, mocked in the browser in the contract's own shapes (xo-space services/launchpad/API.md),
// so shots and smoke tests run the app's real client (js/lpapi.js) end to end. One scenario per page:
//   await install(page, "building")
// Every other non-GET request is aborted: tests never write to the live backend.

const MIN = 60;
const REPO = "sharmasuraj0123/xo-coworker", HOST = "xo-coworker-xo-4f1c2a9.apps.hello-xo.nl", URL_ = `https://${HOST}`;
const RUN_URL = `https://github.com/${REPO}/actions/runs/128`;
// Launchpad's size catalog for the github template (API.md, GET /api/deploy/sizes and preflight's launchpad.sizes)
const TIERS = [{ name: "xo.mini", label: "Mini", cpu: 0.5, memory_gb: 1 }, { name: "xo.small", label: "Small", cpu: 1, memory_gb: 2 }, { name: "xo.medium", label: "Medium", cpu: 1, memory_gb: 4 }, { name: "xo.large", label: "Large", cpu: 2, memory_gb: 8 }];
const SIZES = { template: "github", default: "xo.medium", allowed: TIERS.map((t) => t.name), tiers: TIERS, fixed_after_create: true, source: "launchpad" };

const check = (o = {}) => ({
  schema: 1, project: "xo-coworker", state: "ready", summary: "Ready to deploy as xo-coworker on port 3000.", reasons: [], blockers: [], warnings: [],
  config: null, config_error: null,
  fields: {
    name: { value: "xo-coworker", source: "the project folder" },
    port: { value: 3000, source: "Dockerfile EXPOSE", confident: true },
    health_path: { value: null, source: "default" },
    env: [{ name: "XO_API", sensitive: false, source: ".env.example", default: "http://127.0.0.1:5002" }, { name: "XO_API_KEY", sensitive: true, source: ".env.example" }, { name: "XO_SPACE_ID", sensitive: false, source: ".env.example" }],
    repo: { full_name: null, remote: null, branch: "main", origin: REPO, new_repo_name: "xo-coworker" },
    size: { value: null, source: "the template's default (preflight says which)" }, storage: { value: null, source: "none" },
  },
  git: { repo: true, branch: "main", head: "cd6096efbe28", deployed_head: null, origin_github: REPO },
  prerequisites: { github_connected: true, launchpad_key: true, launchpad_cli: true },
  running: null, last: null, ...o,
});
const linked = { app_id: "app_7f3a", name: "xo-coworker", slug: "xo-coworker", url: URL_, repo: { full_name: REPO, branch: "main" }, port: 3000, env: [] };
const pre = (o = {}) => ({
  state: "ready",
  github: { connected: true, login: "sharmasuraj0123", scopes: ["repo", "workflow"], scopes_known: true, workflow_scope: true, ...(o.github || {}) },
  repo: { branch: "main", origin: REPO, is_admin: true, default_branch: "main", mode: "origin", full_name: REPO, ...(o.repo || {}) },
  launchpad: { key: true, cli: true, name_free: true, ...(o.launchpad?.app ? {} : { sizes: SIZES }), ...(o.launchpad || {}) }, // sizes: not linked
});

// a deploy's events, t seconds after its start
const STEPS = [
  [0, "run"], [0, "step", "check", "running"], [1, "step", "check", "done"], [1, "step", "credentials", "running"], [2, "step", "credentials", "done"],
  [2, "step", "repo", "running", "Using your repository"], [3, "step", "repo", "done"], [3, "step", "app", "running"], [4, "step", "app", "done"],
  [4, "step", "prepare", "running"], [5, "step", "prepare", "done"], [5, "step", "push", "running", "Pushing main to GitHub"], [9, "step", "push", "done", "Pushed cd6096e to main"],
  [9, "step", "create", "running", "Creating xo-coworker on Launchpad"], [12, "step", "create", "done"], [12, "step", "env", "running", "Setting 2 values"], [13, "step", "env", "done"],
  [14, "step", "build", "running", "Building on GitHub Actions"], [16, "progress", "build", { run_id: 128, run_url: RUN_URL, status: "in_progress" }, "Building: Build and push"],
  [212, "step", "build", "done", "Built in 3m 18s"], [212, "step", "release", "running", "Rolling out release #4"], [213, "progress", "release", { release: 4, rollout: "progressing", ready: 0, desired: 1 }, "Release #4 · 0 of 1 ready"],
  [251, "progress", "release", { release: 4, rollout: "ready", ready: 1, desired: 1 }, "Release #4 · 1 of 1 ready"], [252, "step", "release", "done", "Release #4 is serving"],
  [252, "step", "url", "running"], [254, "done"],
];
const UPTO = { "size-refused": 8, "name-taken": 8, "repo-taken": 6, "confirm-repo": 6, "link-existing": 8, "gh-scope-run": 4, pull: 11, pushing: 12, building: 19, releasing: 22, "failed-build": 19, "failed-health": 22, live: STEPS.length };
const ev = (row, start) => {
  const [t, type, step, a, b] = row, ts = new Date(start + t * 1000).toISOString();
  if (type === "run") return { type, ts, run_id: "r1", kind: "deploy", attached: false, started_at: new Date(start).toISOString() };
  if (type === "step") return { type, ts, step, title: step, status: a, message: b || "", elapsed: 0 };
  if (type === "progress") return { type, ts, step, message: b, data: a };
  return { type: "done", ts, url: URL_, http_status: 200, app: { id: "app_7f3a", name: "xo-coworker", slug: "xo-coworker" }, repo: REPO, branch: "main", commit: "cd6096efbe28", release: 4, created: true };
};
const GH_FIX = "Run `gh auth refresh -h github.com -s workflow` on this machine, or connect GitHub in Connections.";
const ENDS = {
  "gh-scope-run": (ts) => ({ type: "error", ts, step: "credentials", code: "github_workflow_scope", action: "reconnect_github", message: "This machine's gh login can't write workflow files, which Launchpad needs.", fix: GH_FIX, data: { source: "gh", scopes: ["repo"] } }),
  "repo-taken": (ts) => ({ type: "needs", ts, step: "repo", code: "repo_name_taken", action: "rename_repo", message: "A repo named xo-coworker already holds other code on your GitHub.", fix: "Pick another name.", options: [], data: { suggestion: "xo-coworker-app" } }),
  "confirm-repo": (ts) => ({ type: "needs", ts, step: "repo", code: "confirm_repo", action: "confirm_repo", message: "launchpad.json deploys to someone-else/xo-coworker, which isn't this project's origin.", fix: "Confirm that repository, or stop here.", options: [{ id: "use_repo", label: "Deploy to someone-else/xo-coworker" }], data: { repo: "someone-else/xo-coworker", origin: REPO } }),
  "link-existing": (ts) => ({ type: "needs", ts, step: "app", code: "link_existing", action: "link", message: "An app named xo-coworker already deploys this repo.", fix: "Link it, then deploy.", options: [], data: { app: { id: "app_1", name: "xo-coworker" } } }),
  "pull": (ts) => ({ type: "error", ts, step: "push", code: "remote_ahead", action: "pull_changes", message: "GitHub has commits this folder doesn't.", fix: "Pull them into the project folder, then deploy again.", data: {} }),

  "failed-build": (ts) => ({ type: "error", ts, step: "build", code: "build_failed", action: "ask_agent", message: "npm ci exited with code 1", fix: "Read the log, fix the cause, push again.", data: { run_url: RUN_URL, failed_step: "RUN npm ci", conclusion: "failure", log_tail: ["#12 [build 4/7] RUN npm ci", "npm ERR! code ERESOLVE", "npm ERR! peer react@\"^18\" from @pierre/diffs@0.4.1"] } }),
  "failed-health": (ts) => ({ type: "error", ts, step: "release", code: "health_check_failed", action: "edit_settings", message: "Release #4 failed its health check on port 3000.", fix: "Use the port the image listens on.", data: { kind: "port", port: 3000, exposed_ports: [8080], release: 4 } }),
  "name-taken": (ts) => ({ type: "needs", ts, step: "app", code: "name_taken", action: "edit_settings", message: "Another app already has this name.", fix: "Pick another name.", options: [], data: { suggestion: "xo-coworker-2" } }),
  "size-refused": (ts) => ({ type: "error", ts, step: "app", code: "size_not_allowed", action: "edit_settings", message: "Launchpad does not allow that machine size for this app.", fix: "Pick one of the template's allowed sizes.", data: { size: "xo.large" } }),
  scope: (ts) => ({ type: "error", ts, step: "credentials", code: "github_workflow_scope", action: "reconnect_github", message: "The GitHub connection cannot write workflow files, which Launchpad needs.", fix: "Reconnect GitHub.", data: {} }),
};
/** The SSE body of a deploy: from its start, `ago` seconds back, up to a scenario's point (and its end). */
function body(sc, ago) {
  const n = UPTO[sc] ?? STEPS.length, last = STEPS[n - 1][0], start = Date.now() - (last + ago) * 1000;
  const list = STEPS.slice(0, n).map((r) => ev(r, start));
  if (ENDS[sc]) list.push(ENDS[sc](new Date().toISOString()));
  return "retry: 3000\n\n" + list.map((e, i) => (e.type === "run" ? `data: ${JSON.stringify(e)}\n\n` : `id: r1:${i}\ndata: ${JSON.stringify({ ...e, run_id: "r1", seq: i })}\n\n`)).join("");
}

const SCENARIOS = {
  checking: { check: "hang" },
  ready: { check: check() },
  detectable: { check: check({ state: "detectable", fields: { ...check().fields, port: { value: 5180, source: "serve.py (PORT)", confident: false }, env: [] } }) },
  "not-admin": { check: check(), pre: pre({ repo: { is_admin: false, mode: "new", full_name: "sharmasuraj0123-bot/xo-coworker", reason: "not admin on origin" } }) },
  scope: { check: check(), pre: pre({ github: { workflow_scope: false, scopes: ["repo"] } }) },
  "name-taken": { check: check({ fields: { ...check().fields, env: [] } }), deploy: "name-taken" },
  "needs-agent": { check: check({ state: "needs-agent", summary: "Needs preparing.", reasons: [{ what: "A Dockerfile", why: "Nothing builds an image yet" }, { what: "A port", why: "Nothing says where it listens" }], fields: { ...check().fields, port: { value: null, source: "" } } }) },
  live: { check: check({ state: "linked", config: linked, git: { ...check().git, deployed_head: "cd6096efbe28" } }), pre: pre({ launchpad: { app: { id: "app_7f3a", name: "xo-coworker", status: "running", url: URL_, exists: true, release: 3, rollout: "ready", last_deploy_at: new Date(Date.now() - 2 * 60e3).toISOString(), ready: 1, desired: 1, size: "xo.small", size_label: "xo.small, 1 CPU and 2 GB memory", storage: { path: "/data", size: "2Gi" } }, env_set: { XO_API: true, XO_API_KEY: true } } }) },
  // linked, and main has moved on since the live release
  "live-behind": { check: check({ state: "linked", config: linked, git: { ...check().git, head: "9e1f0aa77c21", deployed_head: "cd6096efbe28" } }), pre: null },
  // the machine: Launchpad's catalog out of reach (flow.json's table, no default); a size Launchpad refuses;
  // a linked app made without a disk; a linked app as a Space before sizes reports it (today's :5002)
  "sizes-fallback": { check: check(), pre: pre({ launchpad: { sizes: { ...SIZES, default: null, source: "flow.json", error: "launchpad_unreachable" } } }) },
  "size-refused": { check: check(), deploy: "size-refused" },
  "live-nodisk": null, "live-oldspace": null, "live-domain": null, "live-noenv-disk": null,
  "live-stopped": null, "live-failed": null, "live-rolling": null, "live-unhealthy": null,
  "not-deployable": { check: check({ state: "not-deployable" }) },
  pushing: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["pushing", 2] },
  building: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["building", 72 - 16] },
  releasing: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["releasing", 14] },
  "just-live": { check: check({ running: { run_id: "r1", kind: "deploy" } }), pre: pre({ launchpad: { env_set: { XO_API: true, XO_API_KEY: true, XO_SPACE_ID: true } } }), watch: ["live", 1] }, // the deploy set all three
  "failed-build": { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["failed-build", 0] },
  "failed-health": { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["failed-health", 0] },
  play: { check: check(), deploy: "live" },
  "gh-scope": { check: check({ prerequisites: { github_connected: true, github_source: "gh", launchpad_key: true, launchpad_cli: true } }), pre: pre({ github: { source: "gh", workflow_scope: false, scopes: ["repo"], fix: GH_FIX } }) },
  "gh-scope-run": { check: check({ prerequisites: { github_connected: true, github_source: "gh", launchpad_key: true, launchpad_cli: true }, running: { run_id: "r1", kind: "deploy" } }), watch: ["gh-scope-run", 0] },
  "gh-import": { check: check({ prerequisites: { github_connected: false, github_source: null, launchpad_key: true, launchpad_cli: true } }), pre: pre({ github: { connected: false, source: null } }), imports: true, click: ['[data-lp="reconnect"]'] },
  "repo-taken": { check: check(), pre: pre({ repo: { is_admin: false, mode: "new", full_name: "me/xo-coworker" } }), deploy: "repo-taken" },
  "link-existing": { check: check(), deploy: "link-existing" },
  // Space 5897204/7608315: the repo launchpad.json names isn't the person's own; check warns, the deploy asks, use_repo answers
  "confirm-repo": { check: check({ summary: "Ready to deploy as xo-coworker on port 3000, pushing to someone-else/xo-coworker.", warnings: ["Pushes to someone-else/xo-coworker, which isn't your repository."], fields: { ...check().fields, repo: { ...check().fields.repo, full_name: "someone-else/xo-coworker", own: false } } }), deploy: "confirm-repo" },
  pull: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["pull", 0] },
  lost: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["building", 56], lose: true },
  "play-build": { check: check(), deploy: "failed-build" },
  "play-health": { check: check(), deploy: "failed-health" },
  device: { check: check(), pre: pre({ github: { workflow_scope: false } }), click: ['[data-lp="reconnect"]'] },
  pick: { check: check(), click: ['[data-lp="pick"]'] },
  getting: { check: check({ state: "needs-agent", reasons: [] }), agent: true, click: ['[data-lp="ask"]'] },
  undo: { check: check(), click: ['[data-lp="deploy"]'] },
};
const APPS = [
  { id: "app_1", name: "storefront", status: "running", url: "https://storefront-xo-8288e36.apps.hello-xo.nl", linkable: true },
  { id: "app_2", name: "api-gateway", status: "progressing", url: "https://api-gateway-xo-37ec5cd.apps.hello-xo.nl", linkable: true },
  { id: "app_3", name: "billing-worker", status: "failed", url: "https://billing-worker-xo-b114583.apps.hello-xo.nl", linkable: true },
];

// a linked app in each of Launchpad's other states (the open section must say it, not only the head)
for (const [k, st] of [["live-stopped", "stopped"], ["live-failed", "failed"], ["live-rolling", "progressing"], ["live-unhealthy", "unhealthy"]]) {
  const p = pre({ launchpad: { app: { ...SCENARIOS.live.pre.launchpad.app, status: st, ...(st === "stopped" ? { ready: 0, desired: 0 } : {}) }, env_set: SCENARIOS.live.pre.launchpad.env_set } });
  SCENARIOS[k] = { check: SCENARIOS.live.check, pre: p };
}
SCENARIOS["live-behind"].pre = SCENARIOS.live.pre;
{ const a = SCENARIOS.live.pre.launchpad.app, { size, size_label, storage, ...old } = a;
  SCENARIOS["live-nodisk"] = { check: SCENARIOS.live.check, pre: pre({ launchpad: { app: { ...a, storage: null }, env_set: SCENARIOS.live.pre.launchpad.env_set } }) };
  // a custom domain on Launchpad since launchpad.json was written: preflight's url is the live one
  SCENARIOS["live-domain"] = { check: SCENARIOS.live.check, pre: pre({ launchpad: { app: { ...a, url: "https://coworker.example.com" }, env_set: SCENARIOS.live.pre.launchpad.env_set } }) };
  // Astra on b33d3eb: a linked app with a disk at a long path and no environment declared
  SCENARIOS["live-noenv-disk"] = { check: { ...SCENARIOS.live.check, fields: { ...SCENARIOS.live.check.fields, env: [] } }, pre: pre({ launchpad: { app: { ...a, storage: { path: "/var/lib/postgresql/data", size: "4Gi" } } } }) };
  SCENARIOS["live-oldspace"] = { check: SCENARIOS.live.check, pre: pre({ launchpad: { app: old, env_set: SCENARIOS.live.pre.launchpad.env_set } }) }; }
exports.SCENARIOS = SCENARIOS;
exports.install = async (page, name) => {
  const sc = SCENARIOS[name] || SCENARIOS.ready;
  let imported = false; // a gh login taken as it is: preflight says connected from then on
  const json = (r, o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
  const sse = (r, text) => r.fulfill({ status: 200, contentType: "text/event-stream", body: text });
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname;
    if (/\/api\/deploy\/[^/]+\/check$/.test(path)) return sc.check === "hang" ? undefined : json(r, sc.check);
    if (/\/api\/deploy\/[^/]+\/preflight$/.test(path)) { if (page.__slowPre) await new Promise((ok) => setTimeout(ok, page.__slowPre)); return json(r, imported ? pre() : sc.pre || pre()); }
    // a resume (?run=&after=) of a frozen run: a live Space would hold the stream open with pings; the mock holds the
    // request unanswered instead (a fulfilled body can't stay open), so the run stays as it was
    if (/\/api\/deploy\/[^/]+\/watch$/.test(path) && sc.lose && u.searchParams.get("after")) return sse(r, ""); // a Space that answers with nothing
    if (/\/api\/deploy\/[^/]+\/watch$/.test(path)) { if (u.searchParams.get("after")) { await new Promise((ok) => setTimeout(ok, 120e3)); return r.fulfill({ status: 204, body: "" }).catch(() => {}); } return sse(r, sc.watch ? body(...sc.watch) : ""); }
    if (/\/api\/deploy\/[^/]+\/apps$/.test(path)) return json(r, { apps: APPS, linked: null, name: "xo-coworker" });
    if (/\/api\/deploy\/[^/]+\/link$/.test(path)) return m === "DELETE" ? json(r, { unlinked: { app_id: "app_7f3a" }, forgot: false }) : json(r, { config: { ...linked, app_id: "app_1", name: "storefront", url: APPS[0].url }, app: APPS[0] });
    if (/\/api\/deploy\/[^/]+\/agent$/.test(path)) return json(r, { chat_id: "chat_9460bc3363914c18", thread_ts: "t_ready", already: false, state: "needs-agent" });
    if (/\/api\/deploy\/[^/]+$/.test(path) && m === "POST") { (page.__sent ||= []).push(JSON.parse(r.request().postData() || "{}")); return sse(r, body(sc.deploy === "confirm-repo" && page.__sent.at(-1).use_repo === "someone-else/xo-coworker" ? "live" : sc.deploy || "live", 0)); } // what the deploy asked for, for the smoke
    if (/\/api\/deploy\/[^/]+$/.test(path) && m === "DELETE") return json(r, { stopped: true });
    if (path.endsWith("/connectors/github/cli/start") && sc.imports) imported = true;
    if (path.endsWith("/connectors/github/cli/start")) return json(r, sc.imports ? { status: "connected", imported: true, username: "sharmasuraj0123", user_code: "", session_id: "s1" } : { session_id: "s1", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900 });
    if (path.endsWith("/connectors/github/cli/poll")) return json(r, { status: "pending" });
    if (/\/connectors\/github\/(disconnect|cli\/cancel)$/.test(path)) return json(r, {});
    if (m !== "GET" && m !== "HEAD") return r.abort();
    return r.continue();
  });
  return sc;
};
