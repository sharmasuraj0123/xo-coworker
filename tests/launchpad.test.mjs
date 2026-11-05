// Launchpad's data layer (js/lpapi.js): how Launchpad's app states read, how Space's check and preflight become
// the section's model, and how Space's eleven deploy steps land on the card's four rows. Pure, no network.
//   node tests/launchpad.test.mjs
import assert from "node:assert/strict";
import { appState, model, rows } from "../js/lpapi.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
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
  assert.deepEqual(m.github, { connected: true, workflow: true, login: "" });
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
  const [nd] = play([{ type: "needs", step: "app", code: "name_taken", data: { suggestion: "p-2" }, ts: ts(0) }]);
  assert.deepEqual([nd.type, nd.code, nd.data.suggestion, nd.step], ["needs", "name_taken", "p-2", "repo"]);
});

console.log(`${passed} passed`);
