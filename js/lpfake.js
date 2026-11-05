// PREVIEW ONLY: a scripted stand-in for XO Space's deploy API, so every state of the Launchpad section can
// be seen and shot before the real routes exist. It's chosen by localStorage "xo-lp-demo" (a scenario name
// below) and never loads otherwise. Take this file and its import out before anything ships (the owner's
// rule: no exploration switches on :3000).
//
// The shapes are the ones js/lpapi.js normalises the real API to, so the UI can't tell them apart.

const MIN = 60e3;
const NOW = () => Date.now();
const REPO = { full: "sharmasuraj0123/xo-coworker", branch: "main", admin: true, create: "xo-coworker" };
const ENV = [{ name: "XO_API", sensitive: false, source: ".env.example", default: "http://127.0.0.1:5002" }, { name: "XO_API_KEY", sensitive: true, source: ".env.example" }, { name: "XO_SPACE_ID", sensitive: false, source: ".env.example" }];
const APP = { id: "app_7f3a", name: "xo-coworker", url: "https://xo-coworker-xo-4f1c2a9.apps.xo.builders", host: "xo-coworker-xo-4f1c2a9.apps.xo.builders", status: "live", release: 3, commit: "cd6096e", message: "Merge pull request #37", at: NOW() - 2 * MIN };
const base = (p) => ({ project: p, state: "ready", name: p, port: 3000, portFrom: "the Dockerfile", repo: { ...REPO }, env: ENV, github: { connected: true, workflow: true }, app: null, missing: [], reason: "", running: null, getting: null });

// A run's steps as the stream says them, in order; `at` is ms after the start.
const STEPS = (fail) => [
  { at: 0, step: "repo", state: "doing", text: "Pushing main to GitHub" },
  { at: 1800, step: "repo", state: "done", text: "Pushed cd6096e to main" },
  { at: 1900, step: "build", state: "doing", text: "Building on GitHub Actions", url: "https://github.com/sharmasuraj0123/xo-coworker/actions/runs/128" },
  ...(fail === "build" ? [{ at: 5200, step: "build", state: "failed", text: "npm ci exited with code 1", error: { code: "build_failed", step: "RUN npm ci", log: ["#12 [build 4/7] RUN npm ci", "npm ERR! code ERESOLVE", "npm ERR! peer react@\"^18\" from @pierre/diffs@0.4.1"], url: "https://github.com/sharmasuraj0123/xo-coworker/actions/runs/128" } }] : [
    { at: 5200, step: "build", state: "done", text: "Built in 3m 18s" },
    { at: 5300, step: "release", state: "doing", text: "Starting release #4", ready: 0, of: 1, release: 4 },
    ...(fail === "health" ? [{ at: 8600, step: "release", state: "failed", text: "Health check refused on 3000", release: 4, error: { code: "health_check_failed", port: 3000, declared: 8080, release: 4, last: 3 } }] : [
      { at: 7800, step: "release", state: "done", text: "Release #4 is serving", ready: 1, of: 1, release: 4 },
      { at: 7900, step: "live", state: "done", text: "Live", host: APP.host, url: APP.url, release: 4 },
    ]),
  ]),
];

/** A run frozen part-way (for shots): the events up to `upto`, with the start `ago` ms back. */
const frozen = (upto, ago, fail) => ({ frozen: true, ago, events: STEPS(fail).slice(0, upto) });

export const SCENARIOS = {
  checking: { check: null },
  ready: { check: (p) => base(p) },
  detectable: { check: (p) => ({ ...base(p), state: "detectable", port: 5180, portFrom: "serve.py (PORT)", env: [] }) },
  "not-admin": { check: (p) => ({ ...base(p), repo: { ...REPO, admin: false } }) },
  "name-taken": { check: (p) => ({ ...base(p), env: [] }), taken: true },
  "needs-agent": { check: (p) => ({ ...base(p), state: "needs-agent", port: null, missing: [{ what: "A Dockerfile", why: "Nothing builds an image yet", ok: false }, { what: "A port", why: "Nothing says where it listens", ok: false }, { what: "A git repository", why: REPO.full, ok: true }] }) },
  getting: { check: (p) => ({ ...base(p), state: "needs-agent", getting: { thread: "t_ready", title: "Deploy to Launchpad", since: NOW() - 3 * MIN - 12e3 } }) },
  "not-deployable": { check: (p) => ({ ...base(p), state: "not-deployable", reason: "There's no code here to run." }) },
  scope: { check: (p) => ({ ...base(p), github: { connected: true, workflow: false } }) },
  device: { check: (p) => ({ ...base(p), github: { connected: true, workflow: false } }), device: true },
  undo: { check: (p) => base(p), run: { undo: true } },
  pushing: { check: (p) => base(p), run: frozen(1, 1.1e3) },
  building: { check: (p) => base(p), run: frozen(3, 72e3) },
  releasing: { check: (p) => base(p), run: frozen(5, 14e3) },
  live: { check: (p) => ({ ...base(p), state: "linked", app: { ...APP } }) },
  "just-live": { check: (p) => base(p), run: frozen(8, 2e3) },
  "failed-build": { check: (p) => base(p), run: frozen(4, 1e3, "build") },
  "failed-health": { check: (p) => base(p), run: frozen(6, 1e3, "health") },
  pick: { check: (p) => base(p), pick: true },
  play: { check: (p) => base(p) },
  "play-build": { check: (p) => base(p), fail: "build" },
  "play-health": { check: (p) => base(p), fail: "health" },
};

export const APPS = [
  { id: "app_1", name: "storefront", status: "live", host: "storefront-xo-8288e36.apps.xo.builders" },
  { id: "app_2", name: "api-gateway", status: "rolling", host: "api-gateway-xo-37ec5cd.apps.xo.builders" },
  { id: "app_3", name: "billing-worker", status: "failed", host: "billing-worker-xo-b114583.apps.xo.builders" },
  { id: "app_4", name: "docs-site", status: "stopped", host: "docs-site-xo-91ad0e2.apps.xo.builders" },
];

export function fakeApi(name) {
  const sc = SCENARIOS[name] || SCENARIOS.ready;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    scenario: name,
    sc,
    async check(project) { if (!sc.check) return new Promise(() => {}); await wait(120); return sc.check(project); },
    deploy(project, body, on) {
      if (sc.taken && body.name === project) { setTimeout(() => on({ type: "needs", step: "repo", code: "name_taken", data: { suggestion: `${body.name}-2` } }), 300); return { stop() {} }; }
      const evs = STEPS(sc.fail);
      const ts = evs.map((e) => setTimeout(() => on(e), e.at));
      return { stop() { ts.forEach(clearTimeout); } };
    },
    async apps() { await wait(150); return APPS; },
    async link(project, id) { await wait(200); return { ...APP, id, name: APPS.find((a) => a.id === id)?.name || project }; },
    async unlink() { await wait(150); return true; },
    async githubStart() { await wait(250); return { id: "s1", code: "WDJB-MJHT", url: "https://github.com/login/device" }; },
    async githubPoll() { await wait(1e9); return { done: false }; },
    async githubCancel() {},
    async stop() {},
    async askAgent(project) { await wait(200); return { thread_ts: "t_ready", title: "Deploy to Launchpad", already: false }; },
  };
}
