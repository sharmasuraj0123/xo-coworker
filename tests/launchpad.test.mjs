// Launchpad's data layer (js/lpapi.js): how Launchpad's app states read, how Space's check and preflight become
// the section's model, and how Space's eleven deploy steps land on the card's four rows. Pure, no network.
//   node tests/launchpad.test.mjs
import assert from "node:assert/strict";
import { appState, model, rows, createLpApi, nextStep, RETRY, formKey, launchpadUrl, sizeWords } from "../js/lpapi.js";

let passed = 0;
let chain = Promise.resolve(); // one at a time: the stream tests stand in for fetch
const t = (name, fn) => {
  chain = chain.then(async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
  });
};

// ── an app's state ─────────────────────────────────────────────────────────
t("appState: what's wrong is read before what serves ('unhealthy' holds 'healthy')", () => {
  assert.deepEqual(appState("unhealthy"), ["stop", "Didn't go live"]);
  assert.deepEqual(appState("Unhealthy"), ["stop", "Didn't go live"]);
  assert.deepEqual(appState("healthy"), ["go", "Live"]);
  assert.deepEqual(appState("running"), ["go", "Live"]);
  assert.deepEqual(appState("ready"), ["go", "Live"]);
  assert.deepEqual(appState("failed"), ["stop", "Didn't go live"]);
  assert.deepEqual(appState("crashloop"), ["stop", "Didn't go live"]);
  assert.deepEqual(appState("degraded"), ["stop", "Didn't go live"]);
  assert.deepEqual(appState("progressing"), ["work", "Rolling out"]);
  assert.deepEqual(appState("deploying"), ["work", "Rolling out"]);
  assert.deepEqual(appState("stopped"), ["", "Stopped"]);
  assert.deepEqual(appState("paused"), ["", "Stopped"]);
});
t("appState: a word it doesn't know is said as it is, never as Live", () => {
  assert.deepEqual(appState("archived"), ["", "Archived"]);
  assert.deepEqual(appState(""), ["", "Unknown"]);
  assert.notEqual(appState("unrunnable")[0], "go"); // a serving word inside another isn't serving
});

// ── the form's redraw key ────────────────────────────────────────────────
t("formKey: everything the form draws is in it: GitHub connecting (gh import), its scope and fix, the repo, blockers, env, the panel's own state", () => {
  const c = model(check(), { github: { connected: false }, repo: { mode: "origin" }, launchpad: {} });
  const k = formKey(c, { pre: 2 });
  const after = model(check(), { github: { connected: true, source: "gh", workflow_scope: true }, repo: { mode: "origin" }, launchpad: {} });
  assert.notEqual(formKey(after, { pre: 2 }), k, "connected: false → true redraws (Astra's gh-import case: same pre, same workflow)");
  const variants = [
    model(check(), { github: { connected: true, source: "gh", workflow_scope: false, fix: "Run `gh auth refresh`" }, repo: { mode: "origin" }, launchpad: {} }),
    model(check(), { github: { connected: false }, repo: { mode: "new", full_name: "me/p" }, launchpad: {} }),
    model(check({ blockers: ["no branch checked out"] }), { github: { connected: false }, repo: { mode: "origin" }, launchpad: {} }),
    model(check({ warnings: ["3 uncommitted changes"] }), { github: { connected: false }, repo: { mode: "origin" }, launchpad: {} }),
  ];
  for (const v of variants) assert.notEqual(formKey(v, { pre: 2 }), k);
  for (const extra of [{ pre: 1 }, { pre: 2, envAll: true }, { pre: 2, thread: true }, { pre: 2, errs: { name: "x" } }, { pre: 2, needs: ["link_existing"] }]) assert.notEqual(formKey(c, extra), k, JSON.stringify(extra));
  assert.equal(formKey(model(check(), { github: { connected: false }, repo: { mode: "origin" }, launchpad: {} }), { pre: 2 }), k, "the same answers keep the form as it is");
});

t("model: which environment names are set on Launchpad comes from preflight, by name only; a form for the app's settings redraws", () => {
  const before = model(check(), { github: { connected: true, workflow_scope: true }, repo: { mode: "origin" }, launchpad: {} });
  assert.deepEqual(before.env.map((x) => x.set), [false, false], "check alone knows no values on Launchpad");
  const m = model(check(), { github: { connected: true, workflow_scope: true }, repo: { mode: "origin" }, launchpad: { env_set: { KEY: true } } });
  assert.deepEqual(m.env.map((x) => [x.name, x.set]), [["KEY", true], ["LOG", false]]);
  assert.ok(!JSON.stringify(m.env).includes("value"), "no value is ever in the model");
  assert.notEqual(formKey(m, { pre: 2 }), formKey(before, { pre: 2 }), "a name set since redraws the form");
  assert.notEqual(formKey(m, { pre: 2, editing: true }), formKey(m, { pre: 2 }), "the app's settings are their own form");
});

// ── the machine and the address (xo-space 3886701) ─────────────────────────
const TIERS = [{ name: "xo.mini", label: "Mini", cpu: 0.5, memory_gb: 1 }, { name: "xo.small", label: "Small", cpu: 1, memory_gb: 2 }, { name: "xo.medium", label: "Medium", cpu: 1, memory_gb: 4 }, { name: "xo.large", label: "Large", cpu: 2, memory_gb: 8 }];
const GH = { github: { connected: true, workflow_scope: true }, repo: { mode: "origin" } };
t("model: the size picker offers only the template's allowed sizes, in the catalog's order, with its default", () => {
  const m = model(check(), { ...GH, launchpad: { sizes: { template: "github", default: "xo.medium", allowed: ["xo.medium", "xo.small"], tiers: TIERS, fixed_after_create: true, source: "launchpad" } } });
  assert.deepEqual(m.sizes.tiers.map((t) => t.name), ["xo.small", "xo.medium"]);
  assert.equal(m.sizes.def, "xo.medium");
  assert.equal(model(check(), { ...GH, launchpad: {} }).sizes, null, "a Space without sizes: no picker");
  assert.equal(model(check()).sizes, null, "before preflight: no picker yet");
});
t("model: flow.json's fallback table has no default (Launchpad's catalog out of reach), and a default outside allowed isn't one", () => {
  const m = model(check(), { ...GH, launchpad: { sizes: { template: "github", default: null, allowed: TIERS.map((t) => t.name), tiers: TIERS, source: "flow.json", error: "launchpad_unreachable" } } });
  assert.equal(m.sizes.def, "");
  assert.equal(m.sizes.source, "flow.json");
  assert.equal(model(check(), { ...GH, launchpad: { sizes: { default: "xo.large", allowed: ["xo.small"], tiers: TIERS } } }).sizes.def, "");
});
t("model: launchpad.json's size and disk fill a new app's form (null: the default, no disk)", () => {
  const m = model(check({ fields: { ...check().fields, size: { value: "xo.small" }, storage: { value: { path: "/data", size_gb: 5 } } } }));
  assert.equal(m.size, "xo.small");
  assert.deepEqual(m.storage, { path: "/data", gb: 5 });
  const d = model(check({ fields: { ...check().fields, size: { value: null }, storage: { value: null } } }));
  assert.equal(d.size, "");
  assert.equal(d.storage, null);
});
t("model: a linked app's size and disk come from preflight (Launchpad's '2Gi'); none known from an older Space", () => {
  const cfg = { app_id: "a1", name: "p", url: "https://p-xo-1234567.apps.hello-xo.nl" };
  const m = model(check({ state: "linked", config: cfg }), { ...GH, launchpad: { app: { status: "running", size: "xo.small", size_label: "xo.small, 1 CPU and 2 GB memory", storage: { path: "/data", size: "2Gi" } } } });
  assert.equal(m.app.size, "xo.small");
  assert.deepEqual(m.app.storage, { path: "/data", gb: 2 });
  assert.equal(model(check({ state: "linked", config: cfg }), { ...GH, launchpad: { app: { status: "running", size: "xo.small", storage: null } } }).app.storage, null, "made without a disk");
  assert.equal(model(check({ state: "linked", config: cfg }), { ...GH, launchpad: { app: { status: "running" } } }).app.storage, undefined, "an older Space says nothing of disks");
  assert.deepEqual(model(check({ state: "linked", config: { ...cfg, size: "xo.large", storage: { path: "/srv", size_gb: 4 } } })).app.storage, { path: "/srv", gb: 4 }, "before preflight: launchpad.json's");
});
t("model: the address is Launchpad's: preflight's live url (a custom domain) over launchpad.json's", () => {
  const cfg = { app_id: "a1", name: "p", url: "https://p-xo-1234567.apps.hello-xo.nl" };
  assert.equal(model(check({ state: "linked", config: cfg })).app.host, "p-xo-1234567.apps.hello-xo.nl");
  const m = model(check({ state: "linked", config: cfg }), { ...GH, launchpad: { app: { status: "running", url: "https://shop.example.com" } } });
  assert.equal(m.app.url, "https://shop.example.com");
  assert.equal(m.app.host, "shop.example.com");
});
t("sizeWords: a tier, Launchpad's own label, or the name as it is", () => {
  assert.equal(sizeWords(TIERS[0]), "Mini · 0.5 CPU, 1 GB memory");
  assert.equal(sizeWords(null, "xo.medium, 1 CPU and 4 GB memory"), "Medium · 1 CPU, 4 GB memory");
  assert.equal(sizeWords(null, "something else"), "something else");
  assert.equal(sizeWords(undefined, ""), "");
});
t("formKey: the size catalog, launchpad.json's machine and a linked app's are in it", () => {
  const a = model(check(), { ...GH, launchpad: { sizes: { default: "xo.medium", tiers: TIERS } } });
  const b = model(check(), { ...GH, launchpad: { sizes: { default: "xo.small", tiers: TIERS } } });
  assert.notEqual(formKey(a, { pre: 2 }), formKey(b, { pre: 2 }));
});

// ── Open in Launchpad ─────────────────────────────────────────────────────
t("launchpadUrl: xo-swarm's app page by the app's UUID, nothing without one", () => {
  assert.equal(launchpadUrl("0ffce8a6-0dad-4a2a-88c1-583cf3222328"), "https://dev.xo.builders/launchpad/0ffce8a6-0dad-4a2a-88c1-583cf3222328");
  assert.equal(launchpadUrl(""), "");
  assert.equal(launchpadUrl(undefined), "");
});
t("rows: the app's id reaches the panel: from create's progress, and with done (so the link works the moment it's live)", () => {
  const out = play([
    { type: "progress", step: "create", data: { app_id: "a-1", url: "https://p-xo-1.apps.example.nl" }, message: "Created", ts: ts(1) },
    { type: "done", url: "https://p-xo-1.apps.example.nl", release: 1, commit: "abc1234def", app: { id: "a-1", name: "p", slug: "p-xo-1" }, ts: ts(2) },
  ]);
  assert.deepEqual(out.find((e) => e.type === "app"), { type: "app", id: "a-1", at: Date.parse(ts(1)) });
  const live = out.at(-1);
  assert.deepEqual([live.step, live.app.id, live.app.slug, live.commit], ["live", "a-1", "p-xo-1", "abc1234"]);
});

// ── Space's action → the panel's next step ────────────────────────────────
t("nextStep: what's done outside the panel offers no lit button; the rest map to theirs; unknown offers Try again", () => {
  for (const a of ["pull_changes", "sign_in_xo", "reinstall_space", "manual", "none"]) assert.equal(nextStep(a), null, a);
  assert.deepEqual(nextStep("connect_github"), ["Connect GitHub", "reconnect"]);
  assert.deepEqual(nextStep("reconnect_github"), ["Reconnect GitHub", "reconnect"]);
  assert.deepEqual(nextStep("link"), ["Link it", "link-same"]);
  assert.deepEqual(nextStep("open_build_log"), ["Open the build log", "log"]);
  assert.deepEqual(nextStep("something_new"), ["Try again", "retry"]);
  assert.deepEqual(nextStep(undefined), ["Try again", "retry"]);
});

// ── check and preflight ────────────────────────────────────────────────────
const check = (o = {}) => ({
  project: "p", state: "ready", summary: "Ready.", reasons: [], blockers: [], warnings: [], config: null,
  fields: { name: { value: "p", source: "the project folder" }, port: { value: 3000, source: "Dockerfile EXPOSE", confident: true }, env: [{ name: "KEY", sensitive: true, source: ".env.example" }, { name: "LOG", sensitive: false, source: ".env.example", default: "info" }], repo: { branch: "main", origin: "o/p", new_repo_name: "p" } },
  git: { branch: "main", head: "a", deployed_head: null }, prerequisites: { github_connected: true }, running: null, ...o,
});
t("model: check alone takes origin as usable and GitHub as able until preflight says otherwise", () => {
  const m = model(check());
  assert.equal(m.state, "ready");
  assert.equal(m.port, 3000);
  assert.equal(m.repo.full, "o/p");
  assert.equal(m.repo.admin, true);
  assert.deepEqual(m.github, { connected: true, workflow: true, login: "", source: null, fix: "" });
  assert.equal(m.pre, false);
  assert.deepEqual(m.env.map((x) => [x.name, x.sensitive, x.default]), [["KEY", true, ""], ["LOG", false, "info"]]);
});
t("model: preflight's answers win: a new private repo, GitHub without workflow, the linked app's state", () => {
  const pre = { github: { connected: true, workflow_scope: false }, repo: { mode: "new", full_name: "me/p", reason: "not admin" }, launchpad: { app: { status: "unhealthy", release: 4, last_deploy_at: "2026-11-05T12:00:00Z", exists: true } } };
  const m = model(check({ state: "linked", config: { app_id: "a1", name: "p", url: "https://p-xo-abc.apps.example.nl" } }), pre);
  assert.equal(m.repo.admin, false);
  assert.equal(m.repo.full, "me/p");
  assert.equal(m.github.workflow, false);
  assert.equal(m.app.host, "p-xo-abc.apps.example.nl");
  assert.equal(m.app.status, "unhealthy");
  assert.equal(appState(m.app.status)[0], "stop");
});
t("model: GitHub not connected (Space's preflight today) and Space's reasons as plain sentences", () => {
  const m = model(check({ state: "needs-agent", reasons: ["index.html sits beside server code (serve.py)"] }), { github: { connected: false }, repo: { mode: "new" }, launchpad: {} });
  assert.equal(m.github.connected, false);
  assert.deepEqual(m.missing, [{ what: "index.html sits beside server code (serve.py)", why: "", ok: false }]);
});
t("model: a gh login on this machine counts as connected; its missing workflow scope comes with Space's fix", () => {
  const fix = "Run `gh auth refresh -h github.com -s workflow`, or connect GitHub in Connections.";
  const m = model(check({ prerequisites: { github_connected: true, github_source: "gh" } }), { github: { connected: true, source: "gh", login: "me", workflow_scope: false, fix }, repo: { mode: "origin" }, launchpad: {} });
  assert.deepEqual([m.github.connected, m.github.source, m.github.workflow, m.github.fix, m.github.login], [true, "gh", false, fix, "me"]);
  assert.equal(model(check({ prerequisites: { github_connected: true, github_source: "gh" } })).github.source, "gh", "check alone says which login");
});
t("model: a deploy running is followed; a watch isn't", () => {
  assert.equal(model(check({ running: { run_id: "r1", kind: "deploy" } })).running, "r1");
  assert.equal(model(check({ running: { run_id: "r2", kind: "watch" } })).running, null);
});

// ── a deploy's events onto the card's rows ─────────────────────────────────
const ts = (s) => new Date(Date.UTC(2026, 10, 5, 12, 0, s)).toISOString();
const play = (events) => { const out = []; const take = rows((e) => out.push(e)); events.forEach(take); return out; };
const step = (s, st, at, message = "") => ({ type: "step", step: s, status: st, message, ts: ts(at) });
t("rows: everything before the build is the repository's row; it ends on what the push did", () => {
  const out = play([
    { type: "run", run_id: "r", kind: "deploy", started_at: ts(0), ts: ts(0) },
    step("check", "running", 0), step("check", "done", 1), step("push", "running", 2, "Pushing main"), step("push", "done", 5, "Pushed abc to main"),
    step("create", "running", 5, "Creating the app"), step("env", "running", 7, "Setting 1 value"), step("env", "done", 8),
    step("build", "running", 9, "Building"),
  ]);
  assert.equal(out[0].type, "run");
  assert.equal(out[0].started, Date.parse(ts(0)));
  const repo = out.filter((e) => e.step === "repo");
  assert.ok(repo.slice(0, -1).every((e) => e.state === "doing"), "the row stays doing through its steps");
  assert.deepEqual([repo.at(-1).state, repo.at(-1).text], ["done", "Pushed abc to main"]);
  assert.deepEqual([out.at(-1).step, out.at(-1).state], ["build", "doing"]);
  assert.equal(out.at(-1).at, Date.parse(ts(9)), "Space's time, so a replay keeps its clocks");
});
t("rows: progress fills the build's link and the release's n of m; done closes every row", () => {
  const out = play([
    step("build", "running", 0), { type: "progress", step: "build", data: { run_url: "https://gh/run/1" }, message: "Building", ts: ts(1) },
    step("build", "done", 2, "Built"), step("release", "running", 3),
    { type: "progress", step: "release", data: { release: 4, ready: 0, desired: 1 }, message: "0 of 1", ts: ts(4) },
    { type: "done", url: "https://p-xo-abc.apps.example.nl", release: 4, commit: "abcdef123", ts: ts(9) },
  ]);
  assert.ok(out.some((e) => e.step === "build" && e.url === "https://gh/run/1"));
  assert.ok(out.some((e) => e.step === "release" && e.ready === 0 && e.of === 1 && e.release === 4));
  assert.ok(out.some((e) => e.step === "release" && e.state === "done"), "release closes when live arrives");
  const live = out.at(-1);
  assert.deepEqual([live.step, live.state, live.host, live.release, live.commit], ["live", "done", "p-xo-abc.apps.example.nl", 4, "abcdef1"]);
});
t("rows: an error lands on its row with Space's words and data; a decision passes through as needs", () => {
  const [err] = play([{ type: "error", step: "build", code: "build_failed", message: "npm ci failed", fix: "Fix it", data: { run_url: "u", failed_step: "RUN npm ci", log_tail: ["1", "2", "3", "4"] }, ts: ts(0) }]);
  assert.deepEqual([err.step, err.state, err.error.code, err.error.step, err.error.url, err.error.fix], ["build", "failed", "build_failed", "RUN npm ci", "u", "Fix it"]);
  assert.deepEqual(err.error.log, ["2", "3", "4"], "the log's last three lines");
  const [hc] = play([{ type: "error", step: "release", code: "health_check_failed", message: "m", data: { port: 3000, exposed_ports: [8080], release: 4 }, ts: ts(0) }]);
  assert.deepEqual([hc.step, hc.error.port, hc.error.declared, hc.error.release], ["release", 3000, 8080, 4]);
  const [nd] = play([{ type: "needs", step: "app", code: "name_taken", action: "edit_settings", data: { suggestion: "p-2" }, ts: ts(0) }]);
  assert.deepEqual([nd.type, nd.code, nd.data.suggestion, nd.step, nd.action], ["needs", "name_taken", "p-2", "repo", "edit_settings"]);
  const [sc] = play([{ type: "error", step: "credentials", code: "github_workflow_scope", action: "reconnect_github", message: "m", data: { source: "gh" }, ts: ts(0) }]);
  assert.deepEqual([sc.error.action, sc.error.source], ["reconnect_github", "gh"]);
});
t("rows: a watch replaced by a new deploy says so, so the panel can follow the new one", () => {
  const [r] = play([{ type: "replaced", by: { run_id: "r9", kind: "deploy" }, ts: ts(0) }]);
  assert.deepEqual([r.type, r.by.run_id], ["replaced", "r9"]);
});

// ── a stream that drops is picked up where it stopped ──────────────────────
const sseBody = (events) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("retry: 3000\n\n" + events.map((e) => `id: ${e.run_id}:${e.seq}\ndata: ${JSON.stringify(e)}\n\n`).join(""))); c.close(); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
t("stream: a drop before the end resumes from the last event (run and seq), and repeats aren't applied twice", async () => {
  const urls = [];
  const ev = (seq, extra) => ({ run_id: "r1", seq, ts: ts(seq), ...extra });
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1) return sseBody([ev(1, { type: "step", step: "push", status: "running" }), ev(2, { type: "step", step: "build", status: "running" })]);
    // Space answers after=2 with what follows; this one also repeats seq 2, which must be skipped
    return sseBody([ev(2, { type: "step", step: "build", status: "running" }), ev(3, { type: "done", url: "https://a-xo-1.apps.example.nl", release: 1, commit: "abc" })]);
  };
  const got = [];
  await new Promise((resolve) => { createLpApi().watch("p", (e) => { got.push(e); if (e.step === "live") resolve(); }); });
  assert.equal(urls.length, 2);
  assert.match(urls[1], /\/watch\?run=r1&after=2$/);
  assert.equal(got.filter((e) => e.step === "build" && e.state === "doing").length, 1, "seq 2 applied once");
  assert.deepEqual(got.at(-1).state, "done");
});
t("stream: a resume Space answers with a new run (it no longer knew the old one) counts that run from 1", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1) return sseBody([10, 11].map((n) => ({ run_id: "old", seq: n, ts: ts(n), type: "step", step: "build", status: "running" })));
    return sseBody([
      { run_id: "new", type: "run", kind: "watch", ts: ts(20) },
      { run_id: "new", seq: 1, ts: ts(21), type: "done", url: "https://a-xo-1.apps.example.nl", release: 2, commit: "def" },
    ]);
  };
  const got = [];
  await Promise.race([new Promise((resolve) => { createLpApi().watch("p", (e) => { got.push(e); if (e.step === "live") resolve(); }); }), new Promise((r) => setTimeout(r, 4000))]);
  assert.match(urls[1], /run=old&after=11$/);
  assert.equal(got.at(-1).step, "live", "the new run's seq 1 isn't taken for a repeat of the old run's 11");
  assert.equal(urls.length, 2, "no resume of the new run from the old seq");
});
t("stream: 204 on a resume means this viewer already had the end: no error", async () => {
  let n = 0;
  globalThis.fetch = async () => (++n === 1 ? sseBody([{ run_id: "r2", seq: 1, ts: ts(1), type: "step", step: "build", status: "running" }]) : new Response(null, { status: 204 }));
  const got = [];
  createLpApi().watch("p", (e) => got.push(e));
  await new Promise((r) => setTimeout(r, 3300));
  assert.equal(n, 2);
  assert.ok(!got.some((e) => e.state === "failed"), "no error after a 204");
  assert.deepEqual([got.at(-1).type, got.at(-1).run], ["ended", "r2"], "the panel is told which run is over, to read where things stand");
});

t("stream: resumes that bring nothing new don't retry forever: after five, the panel is told it lost touch", async () => {
  RETRY.ms = 10;
  let n = 0;
  globalThis.fetch = async () => (++n === 1 ? sseBody([{ run_id: "r3", seq: 4, ts: ts(4), type: "step", step: "build", status: "running" }]) : sseBody([]));
  const got = [];
  await new Promise((resolve) => { createLpApi().watch("p", (e) => { got.push(e); if (e.type === "lost") resolve(); }); setTimeout(resolve, 2000); });
  assert.equal(n, 6, "the first stream, then five resumes that each answered 200 with nothing");
  assert.equal(got.at(-1).type, "lost");
  assert.ok(!got.some((e) => e.state === "failed"), "losing touch isn't a failed step");
});
t("stream: a resume that brings something new earns its five tries again", async () => {
  RETRY.ms = 10;
  let n = 0;
  globalThis.fetch = async () => { n++; return n === 1 ? sseBody([{ run_id: "r4", seq: 1, ts: ts(1), type: "step", step: "build", status: "running" }]) : n === 4 ? sseBody([{ run_id: "r4", seq: 2, ts: ts(2), type: "progress", step: "build", data: {}, message: "m" }]) : sseBody([]); };
  const got = [];
  await new Promise((resolve) => { createLpApi().watch("p", (e) => { got.push(e); if (e.type === "lost") resolve(); }); setTimeout(resolve, 2000); });
  assert.equal(n, 1 + 3 + 5, "three resumes, one with news, then five more");
  RETRY.ms = 3000;
});

await chain;
console.log(`${passed} passed`);
