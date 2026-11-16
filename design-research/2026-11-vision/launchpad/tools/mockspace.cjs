// Space's deploy routes, mocked in the browser in the contract's own shapes (xo-space services/launchpad/API.md),
// so shots and smoke tests run the app's real client (js/lpapi.js) end to end. One scenario per page:
//   await install(page, "building")
// Every other non-GET request is aborted: tests never write to the live backend.

const MIN = 60;
const REPO = "sharmasuraj0123/xo-coworker", HOST = "xo-coworker-xo-4f1c2a9.apps.xo.builders", URL_ = `https://${HOST}`;
const RUN_URL = `https://github.com/${REPO}/actions/runs/128`;

const check = (o = {}) => ({
  schema: 1, project: "xo-coworker", state: "ready", summary: "Ready to deploy as xo-coworker on port 3000.", reasons: [], blockers: [], warnings: [],
  config: null, config_error: null,
  fields: {
    name: { value: "xo-coworker", source: "the project folder" },
    port: { value: 3000, source: "Dockerfile EXPOSE", confident: true },
    health_path: { value: null, source: "default" },
    env: [{ name: "XO_API", sensitive: false, source: ".env.example", default: "http://127.0.0.1:5002" }, { name: "XO_API_KEY", sensitive: true, source: ".env.example" }, { name: "XO_SPACE_ID", sensitive: false, source: ".env.example" }],
    repo: { full_name: null, remote: null, branch: "main", origin: REPO, new_repo_name: "xo-coworker" },
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
  launchpad: { key: true, cli: true, name_free: true, ...(o.launchpad || {}) },
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
const UPTO = { "name-taken": 8, "confirm-repo": 6, "other-apps": 9, pushing: 12, building: 19, releasing: 22, "failed-build": 19, "failed-health": 22, live: STEPS.length };
const ev = (row, start) => {
  const [t, type, step, a, b] = row, ts = new Date(start + t * 1000).toISOString();
  if (type === "run") return { type, ts, run_id: "r1", kind: "deploy", attached: false, started_at: new Date(start).toISOString() };
  if (type === "step") return { type, ts, step, title: step, status: a, message: b || "", elapsed: 0 };
  if (type === "progress") return { type, ts, step, message: b, data: a };
  return { type: "done", ts, url: URL_, http_status: 200, app: { id: "app_7f3a", name: "xo-coworker", slug: "xo-coworker" }, repo: REPO, branch: "main", commit: "cd6096efbe28", release: 4, created: true };
};
const ENDS = {
  "failed-build": (ts) => ({ type: "error", ts, step: "build", code: "build_failed", message: "npm ci exited with code 1", fix: "Read the log, fix the cause, push again.", data: { run_url: RUN_URL, failed_step: "RUN npm ci", conclusion: "failure", log_tail: ["#12 [build 4/7] RUN npm ci", "npm ERR! code ERESOLVE", "npm ERR! peer react@\"^18\" from @pierre/diffs@0.4.1"] } }),
  "failed-health": (ts) => ({ type: "error", ts, step: "release", code: "health_check_failed", message: "Release #4 failed its health check on port 3000.", fix: "Use the port the image listens on.", data: { kind: "port", port: 3000, exposed_ports: [8080], release: 4 } }),
  "confirm-repo": (ts) => ({ type: "needs", ts, step: "repo", code: "confirm_repo", action: "confirm_repo", message: "launchpad.json deploys to someone-else/xo-coworker, which isn't this project's origin.", fix: "Confirm that repository, or stop here.", options: [{ id: "use_repo", label: "Deploy to someone-else/xo-coworker" }], data: { repo: "someone-else/xo-coworker", origin: REPO } }),
  "other-apps": (ts) => ({ type: "needs", ts, step: "push", code: "other_apps", action: "allow_apps", message: "Pushing to acme/todo main would also deploy the Launchpad app todo-xo-ab12cd3, which isn't in your account, and a workflow with no app of its own.", fix: "Push anyway to deploy them too, or stop here.", options: [{ id: "allow_apps", label: "Push anyway" }], data: { repo: "acme/todo", branch: "main", apps: [{ id: "todo-xo-ab12cd3", slug: "todo-xo-ab12cd3", workflow: "launchpad-deploy.yml" }, { id: "deploy-staging.yml", slug: null, workflow: "deploy-staging.yml" }] } }),
  "name-taken": (ts) => ({ type: "needs", ts, step: "app", code: "name_taken", message: "Another app already has this name.", fix: "Pick another name.", options: [], data: { suggestion: "xo-coworker-2" } }),
  scope: (ts) => ({ type: "error", ts, step: "credentials", code: "github_workflow_scope", message: "The GitHub connection cannot write workflow files, which Launchpad needs.", fix: "Reconnect GitHub.", data: {} }),
};
/** The SSE body of a deploy: from its start, `ago` seconds back, up to a scenario's point (and its end). */
function body(sc, ago) {
  const n = UPTO[sc] ?? STEPS.length, last = STEPS[n - 1][0], start = Date.now() - (last + ago) * 1000;
  const list = STEPS.slice(0, n).map((r) => ev(r, start));
  if (ENDS[sc]) list.push(ENDS[sc](new Date().toISOString()));
  return list.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

const SCENARIOS = {
  checking: { check: "hang" },
  ready: { check: check() },
  detectable: { check: check({ state: "detectable", fields: { ...check().fields, port: { value: 5180, source: "serve.py (PORT)", confident: false }, env: [] } }) },
  "not-admin": { check: check(), pre: pre({ repo: { is_admin: false, mode: "new", full_name: "sharmasuraj0123-bot/xo-coworker", reason: "not admin on origin" } }) },
  scope: { check: check(), pre: pre({ github: { workflow_scope: false, scopes: ["repo"] } }) },
  // Space 5897204/7608315: the repo launchpad.json names isn't the person's own; check warns, the deploy asks, use_repo answers
  "confirm-repo": { check: check({ summary: "Ready to deploy as xo-coworker on port 3000, pushing to someone-else/xo-coworker.", warnings: ["Pushes to someone-else/xo-coworker, which isn't your repository."], fields: { ...check().fields, repo: { ...check().fields.repo, full_name: "someone-else/xo-coworker", own: false } } }), deploy: "confirm-repo" },
  // Space PR #296: a push that would also deploy apps outside the account; allow_apps with every id answers
  "other-apps": { check: check(), deploy: "other-apps" },
  "name-taken": { check: check({ fields: { ...check().fields, env: [] } }), deploy: "name-taken" },
  "needs-agent": { check: check({ state: "needs-agent", summary: "Needs preparing.", reasons: [{ what: "A Dockerfile", why: "Nothing builds an image yet" }, { what: "A port", why: "Nothing says where it listens" }], fields: { ...check().fields, port: { value: null, source: "" } } }) },
  live: { check: check({ state: "linked", config: linked, git: { ...check().git, deployed_head: "cd6096efbe28" } }), pre: pre({ launchpad: { app: { id: "app_7f3a", name: "xo-coworker", status: "running", url: URL_, exists: true, release: 3, rollout: "ready", last_deploy_at: new Date(Date.now() - 2 * 60e3).toISOString(), ready: 1, desired: 1 } } }) },
  "live-stopped": null, "live-failed": null, "live-rolling": null, "live-unhealthy": null,
  "not-deployable": { check: check({ state: "not-deployable" }) },
  pushing: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["pushing", 2] },
  building: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["building", 72 - 16] },
  releasing: { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["releasing", 14] },
  "just-live": { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["live", 1] },
  "failed-build": { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["failed-build", 0] },
  "failed-health": { check: check({ running: { run_id: "r1", kind: "deploy" } }), watch: ["failed-health", 0] },
  play: { check: check(), deploy: "live" },
  "play-build": { check: check(), deploy: "failed-build" },
  "play-health": { check: check(), deploy: "failed-health" },
  device: { check: check(), pre: pre({ github: { workflow_scope: false } }), click: ['[data-lp="reconnect"]'] },
  pick: { check: check(), click: ['[data-lp="pick"]'] },
  getting: { check: check({ state: "needs-agent", reasons: [] }), agent: true, click: ['[data-lp="ask"]'] },
  undo: { check: check(), click: ['[data-lp="deploy"]'] },
};
const APPS = [
  { id: "app_1", name: "storefront", status: "running", url: "https://storefront-xo-8288e36.apps.xo.builders", linkable: true },
  { id: "app_2", name: "api-gateway", status: "progressing", url: "https://api-gateway-xo-37ec5cd.apps.xo.builders", linkable: true },
  { id: "app_3", name: "billing-worker", status: "failed", url: "https://billing-worker-xo-b114583.apps.xo.builders", linkable: true },
];

// a linked app in each of Launchpad's other states (the open section must say it, not only the head)
for (const [k, st] of [["live-stopped", "stopped"], ["live-failed", "failed"], ["live-rolling", "progressing"], ["live-unhealthy", "unhealthy"]]) {
  const p = pre({ launchpad: { app: { ...SCENARIOS.live.pre.launchpad.app, status: st } } });
  SCENARIOS[k] = { check: SCENARIOS.live.check, pre: p };
}
// a linked app with its machine known (size and disk), with and without declared environment: the Machine line's Change
{ const a = SCENARIOS.live.pre.launchpad.app, m = { ...a, size: "xo.mini", size_label: "xo.mini, 0.5 CPU and 1 GB memory", storage: { path: "/data", size: "2Gi" } };
  SCENARIOS["live-machine"] = { check: SCENARIOS.live.check, pre: pre({ launchpad: { app: m, env_set: { XO_API: true } } }) };
  SCENARIOS["live-machine-noenv"] = { check: { ...SCENARIOS.live.check, fields: { ...SCENARIOS.live.check.fields, env: [] } }, pre: pre({ launchpad: { app: { ...m, storage: null } } }) }; }
exports.SCENARIOS = SCENARIOS;
exports.install = async (page, name) => {
  const sc = SCENARIOS[name] || SCENARIOS.ready;
  const json = (r, o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
  const sse = (r, text) => r.fulfill({ status: 200, contentType: "text/event-stream", body: text });
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname;
    if (/\/api\/deploy\/[^/]+\/check$/.test(path)) return sc.check === "hang" ? undefined : json(r, sc.check);
    if (/\/api\/deploy\/[^/]+\/preflight$/.test(path)) return json(r, sc.pre || pre());
    if (/\/api\/deploy\/[^/]+\/watch$/.test(path)) return sse(r, sc.watch ? body(...sc.watch) : "");
    if (/\/api\/deploy\/[^/]+\/apps$/.test(path)) return json(r, { apps: APPS, linked: null, name: "xo-coworker" });
    if (/\/api\/deploy\/[^/]+\/link$/.test(path)) return m === "DELETE" ? json(r, { unlinked: { app_id: "app_7f3a" }, forgot: false }) : json(r, { config: { ...linked, app_id: "app_1", name: "storefront", url: APPS[0].url }, app: APPS[0] });
    if (/\/api\/deploy\/[^/]+\/agent$/.test(path)) return json(r, { chat_id: "chat_9460bc3363914c18", thread_ts: "t_ready", already: false, state: "needs-agent" });
    if (/\/api\/deploy\/[^/]+$/.test(path) && m === "POST") { (page.__sent ||= []).push(JSON.parse(r.request().postData() || "{}")); return sse(r, body(sc.deploy === "confirm-repo" && page.__sent.at(-1).use_repo === "someone-else/xo-coworker" ? "live" : sc.deploy === "other-apps" && (page.__sent.at(-1).allow_apps || []).length === 2 ? "live" : sc.deploy || "live", 0)); }
    if (/\/api\/deploy\/[^/]+$/.test(path) && m === "DELETE") return json(r, { stopped: true });
    if (path.endsWith("/connectors/github/cli/start")) return json(r, { session_id: "s1", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900 });
    if (path.endsWith("/connectors/github/cli/poll")) return json(r, { status: "pending" });
    if (/\/connectors\/github\/(disconnect|cli\/cancel)$/.test(path)) return json(r, {});
    if (m !== "GET" && m !== "HEAD") return r.abort();
    return r.continue();
  });
  return sc;
};
