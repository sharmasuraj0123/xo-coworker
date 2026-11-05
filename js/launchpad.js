// Launchpad, in the panel: put a project on the web from where you work (the owner, 5 November).
//
// Deploy, in the header row of a project and of a thread, pulls the panel out with this section on top and
// open. The rest of the time it sits folded at the panel's top: one 40 px head that says where the project
// stands (Not deployed · Building 1m 12s · Live and its address · what went wrong). A 1 px light along its top
// edge says the same in colour, as in the Launchpad demo: green and still when live, a blue sweep while it
// deploys, red when a release didn't go live, amber when it waits for you.
//
// One card tells the whole story: the project as it will run, top to bottom, repository → image → app →
// address. Before a deploy it's the preview, filled from Space's check and redrawn as you type; during one,
// the same rows light up in order; afterwards it's what runs. An error marks the row it happened on and puts
// the fix under it, lit; the alternatives sit below, quieter.
//
// Secrets are typed here, kept in memory only until the deploy request carries them to Launchpad (through
// XO Space, which passes them on and keeps nothing), then wiped. Never localStorage, a URL or a log.
//
// stage.js calls: mount(section), paint(v, open), tone(v), has(v), headless(v). app.js calls: button(v),
// ensure(v), and opens the section through the panel (data-lp-open).

import { ICON } from "./ui.js";
import { esc } from "./util.js";

const I = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const LP_ICON = {
  rocket: I('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'),
  github: I('<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>'),
  image: I('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  app: I('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
  out: I('<path d="M7 17 17 7M8 7h9v9"/>'),
  more: I('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  link: I('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  x: I('<path d="M7 7l10 10M17 7 7 17"/>'),
};

const NODES = ["repo", "build", "release", "live"];
// errors that wait for you rather than fail (amber, not red)
const NEEDS_YOU = new Set(["github_workflow_scope", "github_not_connected", "github_token_invalid"]);
const WORD = { repo: "Pushing", build: "Building", release: "Releasing", live: "Going live" };
const SLUG = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
const CACHE = "xo-lp-state"; // project → its last check's state only (no values, no secrets), so the button doesn't flicker
const AGAIN_MS = 5 * 60e3, ERR_MS = 60e3;

const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; };
const ago = (at) => { const m = Math.round((Date.now() - at) / 60e3); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const since = (at) => `<span class="elapsed" data-since="${at}">${clock(Date.now() - at)}</span>`;
/** An address in two parts: the app's own (xo-coworker-xo-4f1c2a9) and Launchpad's domain (.apps.xo.builders). */
const split = (host) => { const i = String(host || "").indexOf("."); return i < 0 ? [host || "", ""] : [host.slice(0, i), host.slice(i)]; };
const own = (name) => `${esc(name || "your-app")}-xo-<i class="lp-hash">·······</i>`;
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/**
 * api: js/lpapi.js (or the preview's stand-in): check, deploy, apps, link, unlink, githubStart, githubPoll,
 * askAgent. projectOf(v): the project a view belongs to, or null. nameOf(p): its name. go(v): navigate.
 * notify(text): a line in the herald (a deploy finishing while its section is out of sight). onChange():
 * the app re-renders (the header button, the panel).
 */
export function createLaunchpad({ api, projectOf, nameOf = (p) => p, findThread = () => null, go, announce, notify, onChange }) {
  const P = new Map();
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}") || {}; } catch { /* private mode */ }
  const S = { el: null, hs: null, ha: null, body: null, key: "", html: "", v: null };

  const proj = (p) => {
    if (!P.has(p)) P.set(p, { check: null, at: 0, pre: 0, loading: false, err: null, run: null, form: null, device: null, picking: null, asked: null, needs: null, warn: null, menu: false, copied: 0 });
    return P.get(p);
  };
  const changed = () => { onChange && onChange(); };

  // ── what Space says about the project ──────────────────────────────────────
  async function load(p, force = false) {
    const s = proj(p);
    if (s.loading || (!force && s.at && Date.now() - s.at < (s.err ? ERR_MS : AGAIN_MS))) return;
    s.loading = true; s.err = null;
    try {
      const c = await api.check(p);
      s.check = c; s.at = Date.now();
      if (!s.form) s.form = { name: slug(c.name || p), port: c.port ? String(c.port) : "", repo: c.repo?.create || slug(p), env: {}, errs: {} };
      if (c.running && !s.run) watch(p);
      cached[p] = c.state;
      try { localStorage.setItem(CACHE, JSON.stringify(cached)); } catch { /* private mode */ }
    } catch (e) { s.err = e; s.at = Date.now(); }
    s.loading = false;
    changed();
  }

  const newRun = (at = Date.now()) => ({ startedAt: at, steps: {}, error: null, live: null, undo: 0, stop: null });

  /** One event off the deploy stream: its step's state and words; an error stops the run where it is. */
  function take(p, e) {
    const s = proj(p), r = s.run, at = e.at || Date.now(); // Space's own time, so a replayed run keeps its clocks
    if (!r) return;
    if (e.type === "run") { if (e.started) r.startedAt = e.started; return; }
    const st = r.steps[e.step] || (r.steps[e.step] = {});
    if (e.state === "doing" && st.state !== "doing") st.at = at;
    Object.assign(st, { state: e.state, text: e.text || st.text, url: e.url || st.url });
    if (e.ready != null) { st.ready = e.ready; st.of = e.of; }
    if (e.release) r.release = e.release;
    if (e.state === "done") st.took = at - (st.at || at);
    if (e.state === "failed") { st.took = at - (st.at || at); r.error = { text: e.text, ...e.error, node: e.step }; }
    if (e.step === "live" && e.state === "done") {
      r.live = { host: e.host, url: e.url, release: e.release, at };
      s.check = { ...s.check, state: "linked", app: { url: e.url, host: e.host, status: "live", release: e.release, at, commit: s.check?.app?.commit } };
    }
  }

  /** Space's network answers (admin on origin, the workflow scope, the linked app's state), once the section
   *  is open: they can change the repository row and the lit button, so Deploy waits for them. */
  async function preflight(p) {
    const s = proj(p);
    if (!api.preflight || s.pre || !s.check || s.check.state === "not-deployable" || s.check.state === "needs-agent") return;
    s.pre = 1;
    try { const c = await api.preflight(p, s.form?.name); if (c) { s.check = c; s.pre = 2; } else s.pre = 2; }
    catch { s.pre = 2; } // a deploy still says what's wrong, step by step
    changed();
  }

  /** A deploy already running (another tab, another visit): its stream again, from the start. */
  function watch(p) {
    const s = proj(p);
    s.run = newRun();
    s.run.stop = api.watch(p, (e) => event(p, e));
  }

  /** The stream, one event at a time: a decision goes back to the form, the rest onto the card. */
  function event(p, e) {
    const s = proj(p), f = s.form;
    if (!s.run) return;
    if (e.type === "warning") { s.warn = e.message; changed(); return; }
    if (e.type === "needs") {
      s.run = null;
      if (e.code === "name_taken") f.errs = { name: "Taken on Launchpad.", nameFix: e.data.suggestion };
      else if (e.code === "port_missing") f.errs = { port: "Which port does it listen on?" };
      else if (e.code === "create_repo") s.check = { ...s.check, repo: { ...s.check.repo, admin: false, why: e.data.reason || s.check.repo.why } };
      else s.needs = e; // repo_name_taken, link_existing, app_missing: a decision, lit, above the form
      S.key = ""; changed();
      if (f.errs.name || f.errs.port) requestAnimationFrame(() => S.body?.querySelector(`[data-lp-f="${f.errs.name ? "name" : "port"}"]`)?.focus());
      return;
    }
    if (e.state === "doing" || e.state === "done" || e.state === "failed") f.env = {}; // under way: the values have gone with the request
    take(p, e);
    const name = f.name || nameOf(p);
    if (e.step === "live" && e.state === "done") { announce(`${name} is live.`); if (!visible(p)) notify && notify(`${name} is live`); }
    if (e.state === "failed") { announce(`${name} didn't deploy: ${failWords(s.run.error)}.`); if (!visible(p)) notify && notify(`${name}: ${failWords(s.run.error).toLowerCase()}`); }
    changed();
  }

  // ── the screens ────────────────────────────────────────────────────────────
  function screen(p) {
    const s = proj(p), c = s.check;
    if (s.err) return "check-failed";
    if (!c) return "checking";
    if (c.state === "not-deployable") return "none";
    if (s.picking) return "pick";
    if (s.device) return "device";
    if (s.run) return s.run.undo ? "undo" : s.run.error ? "failed" : s.run.live ? "live" : "run";
    if (c.state === "needs-agent" && (c.getting || s.asked || findThread(p))) return "getting";
    if (c.state === "needs-agent") return "needs";
    if (c.app) return "live";
    return "setup";
  }

  /** The head's few words, its tone, and the light's. */
  function summary(p) {
    const s = proj(p), sc = screen(p), r = s.run;
    switch (sc) {
      case "checking": return { tone: "", words: "Checking…" };
      case "check-failed": return { tone: "", words: "Couldn't check" };
      case "setup": case "pick": return { tone: "", words: "Not deployed", cta: true };
      case "needs": return { tone: "", words: "Not ready yet", cta: true };
      case "getting": return { tone: "work", words: "Getting ready", at: (s.check.getting || s.asked || findThread(p)).since };
      case "device": return { tone: "need", words: "Waiting for GitHub" };
      case "undo": return { tone: "work", words: "Starting" };
      case "run": { const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo"; return { tone: "work", words: WORD[on], at: r.startedAt }; }
      case "failed": return { tone: NEEDS_YOU.has(r.error.code) ? "need" : "stop", words: failWords(r.error) };
      case "live": {
        const a = r?.live || s.check.app, st = String(a.status || "");
        if (a.gone) return { tone: "stop", words: "App deleted on Launchpad" };
        if (/fail|crash|error/i.test(st)) return { tone: "stop", words: "Didn't go live", host: a.host, url: a.url };
        if (/stop/i.test(st)) return { tone: "", words: "Stopped", host: a.host, url: a.url };
        return { tone: "go", words: "Live", host: a.host, url: a.url };
      }
      default: return { tone: "", words: "" };
    }
  }
  const failWords = (e) => ({ build_failed: "Build failed", build_timeout: "Build is slow", health_check_failed: "Didn't go live", release_failed: "Didn't go live", release_timeout: "Release is slow", github_workflow_scope: "Needs GitHub", github_not_connected: "Needs GitHub", github_token_invalid: "Needs GitHub", push_rejected: "Push refused", remote_ahead: "Push refused", launchpad_unreachable: "Launchpad didn't answer", github_unreachable: "GitHub didn't answer", launchpad_limit: "App limit reached", launchpad_forbidden: "Launchpad said no", cancelled: "Stopped" })[e.code] || "Didn't deploy";

  // ── the card: the project as it runs, one 44 px row per part ─────────────────
  function rows(p, mode) {
    const s = proj(p), c = s.check, f = s.form, r = s.run;
    const admin = c.repo && c.repo.admin;
    const real = r?.live?.host || (mode === "live" && c.app ? c.app.host : "");
    const [mine, domain] = real ? split(real) : ["", ".apps.xo.builders"];
    const port = f.port || "—";
    const st = (n) => (mode === "preview" ? "plan" : mode === "live" ? "done" : r?.steps[n]?.state || "todo");
    const meta = (n) => {
      const x = st(n), step = r?.steps[n];
      if (n === "live" && x === "done") return "";
      if (x === "done") return `<span class="lp-ok" title="Done">${ICON.check}</span>`;
      if (x === "failed") return `<span class="lp-bad" title="Failed">${LP_ICON.x}</span>`;
      if (x === "doing") return `<span class="lp-tm">${since(step.at)}</span><i class="lp-arc" aria-hidden="true"></i>`;
      return n === "repo" && mode === "preview" ? `<span class="lp-k">${esc(c.repo.branch || "main")}</span>` : n === "release" && mode === "preview" ? `<span class="lp-k">:${esc(port)}</span>` : "";
    };
    const sub = (n) => {
      const step = r?.steps[n], x = st(n);
      if (n === "live") return `<span class="lp-mono">${esc(domain)}</span> · HTTPS`;
      if (mode !== "preview" && step && step.text && x !== "todo") {
        const logs = step.url ? ` · <a class="lp-ln" href="${esc(step.url)}" target="_blank" rel="noopener">Logs</a>` : "";
        if (n === "build" && x === "doing") return `On GitHub Actions${logs}`;
        if (n === "build") return `${esc(step.text)}${logs}`;
        if (n === "release" && x === "doing" && step.of) return `Release #${r.release} · ${step.ready} of ${step.of} ready`;
        return esc(step.text);
      }
      if (n === "repo") return admin ? `Your repository · ${esc(c.repo.branch || "main")}` : `Private, in your GitHub`;
      if (n === "build") return "Built by GitHub Actions on every push";
      return mode === "live" ? `Release #${r?.live?.release || c.app?.release || 1} · port ${esc(port)}` : `1 instance · port ${esc(port)}`;
    };
    const name = {
      repo: admin ? esc(c.repo.full) : `${esc(f.name || slug(p))} <span class="lp-new">new</span>`,
      build: "Image",
      release: esc(f.name || "your-app"),
      live: `<span class="lp-host">${real ? esc(mine) : own(f.name)}</span>`,
    };
    const icon = { repo: LP_ICON.github, build: LP_ICON.image, release: LP_ICON.app, live: ICON.globe };
    return `<ol class="lp-sys" data-mode="${mode}" aria-label="How ${esc(nameOf(p))} runs">${NODES.map((n) =>
      `<li class="lp-n is-${st(n)}" data-n="${n}"><span class="lp-t">${icon[n]}</span><span class="lp-c"><b>${name[n]}</b><span>${sub(n)}</span></span><span class="lp-m">${meta(n)}</span></li>`).join("")}</ol>`;
  }

  const head = (h, p, tone = "") => `<div class="lp-hd"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${h}</h3>${p ? `<p class="lp-p">${p}</p>` : ""}</div>`;
  const rec = (title, text, act, label, icon = "") => `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>${title}</b><p>${text}</p></div><button type="button" class="lp-go" data-lp="${act}">${icon}<span>${label}</span></button></div>`;

  function setupHtml(p) {
    const s = proj(p), c = s.check, f = s.form, e = f.errs || {};
    const admin = c.repo && c.repo.admin, scope = c.github && c.github.connected && c.github.workflow;
    const guessed = c.state === "detectable";
    const env = c.env || [];
    const from = [...new Set(env.map((x) => x.source).filter(Boolean))].join(", ");
    return head(`Put ${esc(nameOf(p))} on the web`, guessed ? "Found these in the project. Check them, then deploy." : "Launchpad builds it on every push and runs it.") +
      rows(p, "preview") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b> as it is now. This thread's work goes out once it's merged.</span></p>` : "") +
      (!admin ? `<p class="lp-note">You're not an admin on <b>${esc(c.repo.full)}</b>, so XO puts a private copy in your GitHub for Launchpad to build.</p>` : "") +
      `<div class="lp-set">` +
      field("name", "Name", f.name, { hint: e.name || "In the address; it can't change later.", bad: !!e.name, fix: e.nameFix }) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `From ${esc(c.portFrom)}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      `</div>` +
      (env.length ? `<fieldset class="lp-env"><legend><span>Environment</span>${from ? `<small>from ${esc(from)}</small>` : ""}</legend>` +
        env.map((x) => `<label class="lp-f lp-ev"><span class="lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><input class="lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(x.default || "")}" value="${esc(f.env[x.name] || "")}" aria-label="${esc(x.name)}"></label>`).join("") +
        `<p class="lp-lock">${ICON.lock}<span>Straight to Launchpad; XO never keeps them.</span></p></fieldset>` : "") +
      (scope
        ? `<button type="button" class="lp-go lp-wide" data-lp="deploy">${LP_ICON.rocket}<span>Deploy ${esc(f.name || nameOf(p))}</span></button>`
        : `<div class="lp-need">${ICON.lock}<p><b>One thing first.</b> GitHub needs the <code>workflow</code> permission so Launchpad can add its build.</p></div><button type="button" class="lp-go lp-wide" data-lp="reconnect">${LP_ICON.github}<span>Reconnect GitHub</span></button>`) +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick">${LP_ICON.link}<span>Link an app already on Launchpad</span></button></div>`;
  }
  function field(id, label, value, { hint = "", bad = false, mode = "text", short = false, fix = "" } = {}) {
    return `<label class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span><span class="lp-v${short ? " is-row" : ""}"><input class="lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><span class="lp-hint" id="lp-h-${id}">${hint}${fix ? ` <button type="button" class="lp-a lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span></span></label>`;
  }

  function runHtml(p) {
    const s = proj(p), r = s.run, name = esc(s.form.name || nameOf(p));
    if (r.undo) return head(`Deploying ${name}`, `Starts in <span class="lp-count" data-until="${r.undo}">${Math.max(1, Math.ceil((r.undo - Date.now()) / 1000))}</span> s.`) + rows(p, "run") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="undo">${ICON.rewind || ICON.retry}<span>Undo</span></button></div>`;
    const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo";
    const what = { repo: "Pushing to GitHub", build: "GitHub Actions is building the image", release: "Launchpad is starting the new release", live: "Going live" }[on];
    return head(`Deploying ${name}`, `${what} · ${since(r.startedAt)} in all`) + rows(p, "run") +
      `<div class="lp-acts"><p class="lp-q">Carries on if you close this.</p><button type="button" class="lp-b" data-lp="stop"><span>Stop</span></button><button type="button" class="lp-b" data-lp="hide"><span>Hide</span></button></div>`;
  }

  function liveHtml(p) {
    const s = proj(p), a = s.run?.live || s.check.app, name = esc(s.form?.name || nameOf(p));
    if (a.gone) return head(`${name}'s app is gone`, "It was deleted on Launchpad. Its repository, port and settings are still here.", "stop") +
      rec("Create it again", "A new app from the same repository, with the same settings.", "recreate", "Create it again", LP_ICON.rocket) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="unlink"><span>Unlink</span></button></div>`;
    const rel = a.release ? `Release #${a.release}` : "Live";
    return head(`${name} is live`, `${rel}${s.check.app?.commit ? ` · from <code>${esc(s.check.app.commit)}</code>` : ""} · ${ago(a.at || Date.now())}`, "go") +
      `<div class="lp-url"><a class="lp-url-a" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open ${esc(a.host)}">${ICON.globe}<span><b>${esc(split(a.host)[0])}</b><i>${esc(split(a.host)[1])}</i></span></a><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button><a class="lp-ib" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open it" aria-label="Open it">${LP_ICON.out}</a></div>` +
      rows(p, "live") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="again">${LP_ICON.rocket}<span>Deploy again</span></button><a class="lp-b" href="https://launchpad.xo.builders/apps/${esc(s.check.app?.id || "")}" target="_blank" rel="noopener"><span>Open in Launchpad</span>${LP_ICON.out}</a>` +
      `<span class="lp-mw"><button type="button" class="lp-ib" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-menu" role="menu"><button type="button" role="menuitem" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span></div>`;
  }

  function failedHtml(p) {
    const s = proj(p), e = s.run.error, name = esc(s.form.name || nameOf(p));
    if (e.code === "build_failed") return head("The build failed", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", "stop") +
      rows(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", LP_ICON.rocket) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button>${e.url ? `<a class="lp-b" href="${esc(e.url)}" target="_blank" rel="noopener"><span>Logs on GitHub</span>${LP_ICON.out}</a>` : ""}</div>`;
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return head(`${e.release ? `Release #${e.release}` : name} didn't go live`, `Nothing answers on port ${e.port}: the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "stop") +
      rows(p, "run") +
      rec(`Use port ${e.declared}`, `The image listens on ${e.declared}; the app sends traffic to ${e.port}.`, "fix-port", `Use port ${e.declared}`) +
      (e.last ? `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="rollback">${ICON.retry}<span>Roll back to #${e.last}</span></button></div>` : "");
    if (e.code === "name_taken") return head("That name is taken", `${esc(e.name)} is already an app on Launchpad.`, "stop") + rows(p, "run") +
      rec(`Use ${esc(e.free)}`, `Its address becomes ${esc(e.free)}-xo-…apps.xo.builders.`, "use-free", `Deploy as ${esc(e.free)}`);
    if (NEEDS_YOU.has(e.code)) return head("GitHub needs one more permission", "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes.", "need") +
      rows(p, "run") + rec("Reconnect GitHub", "Grant it once; the deploy picks up where it stopped.", "reconnect", "Reconnect GitHub", LP_ICON.github);
    return head(`${name} didn't deploy`, esc(e.message || e.text || "Something went wrong on the way."), "stop") + rows(p, "run") +
      (e.fix ? `<p class="lp-note">${esc(e.fix)}</p>` : "") +
      `<div class="lp-acts"><button type="button" class="lp-go" data-lp="retry">${ICON.retry}<span>Try again</span></button></div>`;
  }

  function needsHtml(p) {
    const c = proj(p).check;
    return head(`${esc(nameOf(p))} isn't ready to deploy`, "Launchpad runs an app from a Docker image, and this project doesn't make one yet.") +
      `<ul class="lp-check">${c.missing.map((m) => `<li class="${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lp-c"><b>${esc(m.what)}</b><span>${esc(m.why)}</span></span></li>`).join("")}</ul>` +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", LP_ICON.rocket);
  }

  function gettingHtml(p) {
    const s = proj(p), g = s.check.getting || findThread(p) || s.asked;
    return head(`Getting ${esc(nameOf(p))} ready`, "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here.") +
      `<ul class="lp-ag"><li><button type="button" class="lp-agr" data-lp="thread" data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${g.done ? "" : '<i class="arc"></i>'}</span><span class="lp-c"><b>${esc(g.title)}</b><span>${g.done ? "Done: merge its work, then deploy" : "Working"}</span></span><span class="lp-m">${g.done ? "" : `<span class="lp-tm">${since(g.since)}</span>`}</span></button></li></ul>` +
      rows(p, "preview");
  }

  function deviceHtml(p) {
    const d = proj(p).device;
    return head("Connect GitHub again", "Enter this code on GitHub to grant the <code>workflow</code> permission.", "need") +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code><button type="button" class="lp-b" data-lp="code-copy">${d.copied ? ICON.check : ICON.copy}<span>${d.copied ? "Copied" : "Copy"}</span></button></div>` +
      `<a class="lp-go lp-wide" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a>` +
      `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Waiting for GitHub. This carries on by itself.</span></p>` +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="device-cancel"><span>Cancel</span></button></div>`;
  }

  function pickHtml(p) {
    const s = proj(p), list = s.picking.apps;
    const tone = { live: "go", rolling: "work", failed: "stop", stopped: "" };
    const word = { live: "Live", rolling: "Rolling out", failed: "Didn't go live", stopped: "Stopped" };
    return head("Link an app on Launchpad", `${esc(nameOf(p))} deploys to the app you pick from now on.`) +
      (!list ? `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Reading your apps…</span></p>` :
        `<ul class="lp-apps">${list.map((a) => `<li><button type="button" class="lp-appr" data-lp="link" data-id="${esc(a.id)}"><span class="lp-t">${LP_ICON.app}</span><span class="lp-c"><b>${esc(a.name)}</b><span class="lp-mono">${esc(a.host)}</span></span><span class="lp-m"><span class="lp-st t-${tone[a.status] || ""}">${a.status === "rolling" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}${word[a.status] || esc(a.status)}</span></span></button></li>`).join("")}</ul>`) +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick-cancel"><span>Back</span></button></div>`;
  }

  function checkingHtml(p) {
    return head(`Checking ${esc(nameOf(p))}…`, "Its repository, its port and what it needs to run.") +
      `<ol class="lp-sys is-skel" aria-hidden="true">${NODES.map(() => `<li class="lp-n"><span class="lp-t"></span><span class="lp-c"><b></b><span></span></span><span class="lp-m"></span></li>`).join("")}</ol>`;
  }

  function bodyHtml(p) {
    const sc = screen(p);
    const s = proj(p), c = s.check;
    return {
      key: `${p}|${sc}` + (sc === "setup" ? `|${s.pre}|${c.repo.admin}|${c.github.workflow}|${s.needs?.code || ""}|${JSON.stringify(s.form.errs || {})}` : ""),
      html: sc === "checking" ? checkingHtml(p) : sc === "check-failed" ? head("Couldn't check this project", esc(proj(p).err?.message || "XO Space didn't answer.")) + `<div class="lp-acts"><button type="button" class="lp-b" data-lp="recheck">${ICON.retry}<span>Try again</span></button></div>`
        : sc === "setup" ? setupHtml(p) : sc === "undo" || sc === "run" ? runHtml(p) : sc === "live" ? liveHtml(p) : sc === "failed" ? failedHtml(p)
        : sc === "needs" ? needsHtml(p) : sc === "getting" ? gettingHtml(p) : sc === "device" ? deviceHtml(p) : sc === "pick" ? pickHtml(p) : "",
      form: sc === "setup",
    };
  }

  // ── painting into the frame stage.js made ─────────────────────────────────
  function paint(v, open) {
    if (!S.el) return;
    const p = projectOf(v);
    S.v = v;
    if (!p) return;
    const sm = summary(p);
    S.el.dataset.tone = sm.tone;
    const hs = `<span class="lp-st t-${sm.tone}">${sm.tone === "work" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}<span>${esc(sm.words)}</span>${sm.at ? ` <span class="lp-tm">${since(sm.at)}</span>` : ""}</span>${sm.host ? `<a class="lp-hh" href="${esc(sm.url)}" target="_blank" rel="noopener" title="Open ${esc(sm.host)}">${esc(sm.host)}</a>` : ""}`;
    if (S.hs._h !== hs) { S.hs.innerHTML = hs; S.hs._h = hs; }
    const ha = !open && sm.cta ? `<button type="button" class="lp-hb" data-lp="open">${LP_ICON.rocket}<span>Deploy</span></button>` : sm.url ? `<a class="fr-ib" href="${esc(sm.url)}" target="_blank" rel="noopener" title="Open ${esc(sm.host)}" aria-label="Open it">${LP_ICON.out}</a>` : "";
    if (S.ha._h !== ha) { S.ha.innerHTML = ha; S.ha._h = ha; }
    if (!open) return;
    preflight(p);
    const b = bodyHtml(p);
    // a form is drawn once per screen, never under the person's fingers; the rest redraws when it changes
    if (b.form && S.key === b.key && S.body.querySelector(".lp-set")) { syncPreview(p); return; }
    // a clock's figures aren't a change (the app's ticker moves them); a new screen arrives, the same one doesn't
    const same = b.html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1").replace(/(class="lp-count"[^>]*>)\d+/g, "$1");
    if (S.key !== b.key || S.html !== same) {
      const ae = document.activeElement && S.body.contains(document.activeElement) ? document.activeElement : null;
      const focus = ae ? (ae.dataset.lpF ? `[data-lp-f="${ae.dataset.lpF}"]` : ae.dataset.lpEnv ? `[data-lp-env="${ae.dataset.lpEnv}"]` : ae.dataset.lp ? `[data-lp="${ae.dataset.lp}"]` : null) : null;
      const caret = ae && ae.matches("input") ? [ae.selectionStart, ae.selectionEnd] : null;
      const fresh = S.key.split("|").slice(0, 2).join("|") !== b.key.split("|").slice(0, 2).join("|");
      S.body.innerHTML = `<div class="lp${fresh ? " is-new" : ""}" data-screen="${b.key.split("|")[1]}">${b.html}</div>`;
      if (fresh) S.body.scrollTop = 0;
      S.key = b.key; S.html = same;
      if (focus) { const n = S.body.querySelector(focus); if (n) { n.focus({ preventScroll: true }); if (caret && n.setSelectionRange) try { n.setSelectionRange(...caret); } catch { /* a number field */ } } }
    }
  }
  /** As you type: the card's name, address and port follow the fields, and nothing else redraws. */
  function syncPreview(p) {
    const f = proj(p).form, card = S.body.querySelector(".lp-sys");
    if (!card) return;
    const set = (sel, html) => { const n = card.querySelector(sel); if (n && n.innerHTML !== html) n.innerHTML = html; };
    set('[data-n="release"] b', esc(f.name || "your-app"));
    set('[data-n="live"] .lp-host', own(f.name));
    set('[data-n="release"] .lp-m', `<span class="lp-k">:${esc(f.port || "—")}</span>`);
    set('[data-n="release"] .lp-c > span', `1 instance · port ${esc(f.port || "—")}`);
    const go = S.body.querySelector('[data-lp="deploy"] span');
    if (go) go.textContent = `Deploy ${f.name || nameOf(p)}`;
    if (!proj(p).check.repo.admin) set('[data-n="repo"] b', `${esc(f.name || slug(p))} <span class="lp-new">new</span>`);
  }

  // ── what you do in it ───────────────────────────────────────────────────────
  function validate(p) {
    const s = proj(p), f = s.form, c = s.check, errs = {};
    if (!SLUG.test(f.name)) errs.name = "Lowercase letters, digits and hyphens, up to 40.";
    const port = Number(f.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errs.port = "A port from 1 to 65535.";
    f.errs = errs;
    return !Object.keys(errs).length;
  }

  function deploy(p, again = false) {
    const s = proj(p);
    if (!validate(p)) {
      S.key = ""; changed();
      requestAnimationFrame(() => S.body?.querySelector('.is-bad input, [aria-invalid="true"]')?.focus());
      return;
    }
    s.run = newRun(); s.run.undo = Date.now() + 3e3;
    const t = setInterval(() => {
      if (!s.run || !s.run.undo) { clearInterval(t); return; }
      const left = s.run.undo - Date.now();
      const n = S.body?.querySelector(".lp-count");
      if (n) n.textContent = String(Math.max(1, Math.ceil(left / 1000)));
      if (left <= 0) { clearInterval(t); begin(p, again); }
    }, 200);
    changed();
    announce(`Deploying ${s.form.name} in 3 seconds. Undo to stop it.`);
  }
  function begin(p, again = false) {
    const s = proj(p), f = s.form, c = s.check;
    const env = Object.fromEntries(Object.entries(f.env).filter(([, v]) => v !== ""));
    const body = { name: f.name, port: Number(f.port), ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.name }), ...(c.app && !c.behind && again && !f.recreate ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((x) => x.sensitive).map((x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now();
    s.needs = null; s.warn = null;
    s.run.stop = api.deploy(p, body, (e) => event(p, e));
    changed();
  }
  const visible = (p) => S.el && !S.el.classList.contains("is-folded") && !S.el.hidden && S.v && projectOf(S.v) === p && document.body.classList.contains("stage-open");

  /** Reconnect GitHub with the workflow scope: Space's device flow, polled until it's granted. */
  async function github(p) {
    const s = proj(p);
    s.device = { code: "", url: "", copied: false };
    changed();
    try {
      const d = await api.githubStart(s.check.github.connected);
      if (!s.device) return; // cancelled meanwhile
      s.device = { ...d, copied: false };
      changed();
      while (s.device && s.device.id === d.id && (!d.until || Date.now() < d.until)) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!s.device || s.device.id !== d.id) return;
        const r = await api.githubPoll(d.id);
        if (r?.failed) throw new Error(r.failed);
        if (r?.done) {
          s.device = null; s.pre = 0;
          if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null;
          announce("GitHub is connected again.");
          changed(); preflight(p);
          return;
        }
      }
      if (s.device) { s.device = null; notify && notify("GitHub's code ran out. Reconnect again."); changed(); }
    } catch (e) { s.device = null; notify && notify(`GitHub didn't connect: ${e.message}`); changed(); }
  }

  async function startPick(p) {
    const s = proj(p);
    s.picking = { apps: null };
    changed();
    try { s.picking.apps = await api.apps(); } catch (e) { s.picking = null; s.err = e; }
    changed();
  }

  function act(name, el) {
    const p = projectOf(S.v);
    if (!p) return;
    const s = proj(p);
    switch (name) {
      case "open": onOpen && onOpen(); return;
      case "deploy": deploy(p); return;
      case "undo": if (s.run) { s.run = null; announce("Deploy undone. Nothing changed."); changed(); } return;
      case "hide": onHide && onHide(); return;
      case "stop": {
        if (!s.run || s.run.stopping) return;
        const run = s.run;
        run.stopping = setTimeout(() => { run.stop && run.stop.stop(); if (api.stop) api.stop(p).catch(() => {}); if (s.run === run) s.run = null; announce("Deploy stopped."); changed(); }, 3000);
        notify && notify(`Stopping the deploy of ${s.form.name}`, () => { clearTimeout(run.stopping); run.stopping = 0; changed(); });
        changed();
        return;
      }
      case "recreate": s.form.recreate = true; s.run = null; deploy(p, true); return;
      case "again": s.run = null; s.form.errs = {}; deploy(p, true); return; // the linked app, the same settings: 3 s, then it goes
      case "retry": s.run = null; deploy(p); return;
      case "copy": navigator.clipboard?.writeText((s.run?.live || s.check.app).url).catch(() => {}); s.copied = Date.now() + 1500; changed(); setTimeout(changed, 1600); return;
      case "menu": s.menu = !s.menu; changed(); return;
      case "unlink": s.menu = false; { const was = s.check; s.check = { ...was, app: null, state: "ready" }; s.run = null; changed(); notify && notify("Unlinked from Launchpad", () => { s.check = was; changed(); }); api.unlink(p).catch(() => {}); } return;
      case "pick": startPick(p); return;
      case "pick-cancel": s.picking = null; changed(); return;
      case "link": { const id = el.dataset.id; s.picking = null; api.link(p, id).then((a) => { s.check = { ...s.check, state: "linked", app: a }; changed(); }); changed(); } return;
      case "reconnect": github(p); return;
      case "code-copy": navigator.clipboard?.writeText(s.device.code).catch(() => {}); s.device.copied = true; changed(); return;
      case "device-cancel": if (s.device?.id && api.githubCancel) api.githubCancel(s.device.id); s.device = null; changed(); return;
      case "ask": case "ask-fix": {
        const e = s.run?.error;
        const note = name === "ask-fix" && e ? `The deploy failed: ${e.message || e.text || e.code}${e.step ? ` (in ${e.step})` : ""}. Fix the cause so it deploys.` : "";
        api.askAgent(p, note).then((g) => { s.asked = { thread: g.thread_ts || g.thread, title: g.title || "Deploy to Launchpad", since: Date.now() }; s.run = null; changed(); })
          .catch((err) => notify && notify(`Couldn't start the thread: ${err.message}`));
        return;
      }
      case "thread": go && go(el.dataset.go); return;
      case "fix-port": s.form.port = String(s.run.error.declared); s.run = null; deploy(p); return;
      case "rollback": s.run = null; changed(); return;
      case "use-free": s.form.name = s.run.error.free; s.run = null; deploy(p); return;
      case "use-name": s.form.name = el.dataset.v; s.form.errs = {}; S.key = ""; changed(); return;
      case "recheck": s.err = null; load(p, true); changed(); return;
    }
  }
  let onOpen = null, onHide = null;

  function mount(section, { open, hide }) {
    S.el = section; S.hs = section.querySelector(".lp-hs"); S.ha = section.querySelector(".lp-ha"); S.body = section.querySelector(".fr-b");
    onOpen = open; onHide = hide;
    section.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lp]");
      if (!b || !section.contains(b)) { if (!e.target.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) { proj(p).menu = false; changed(); } } return; }
      e.preventDefault();
      act(b.dataset.lp, b);
    });
    section.addEventListener("input", (e) => {
      const p = projectOf(S.v), t = e.target;
      if (!p || !t.matches("input")) return;
      const f = proj(p).form;
      if (t.dataset.lpF) f[t.dataset.lpF] = t.dataset.lpF === "name" || t.dataset.lpF === "repo" ? t.value.toLowerCase() : t.value.trim();
      if (t.dataset.lpEnv) f.env[t.dataset.lpEnv] = t.value;
      if (f.errs && Object.keys(f.errs).length) { const l = t.closest(".lp-f"); l?.classList.remove("is-bad"); t.removeAttribute("aria-invalid"); }
      syncPreview(p);
    });
    section.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches?.(".lp-in")) { e.preventDefault(); act("deploy"); }
    });
  }

  return {
    mount, paint,
    /** Does this view's project get a Launchpad section (and the header's Deploy)? Unknown counts as yes. */
    has(v) {
      const p = projectOf(v);
      if (!p) return false;
      const s = P.get(p);
      if (s?.err && s.err.status === 404 && !s.check) return false; // this Space has no deploy routes, or no such project
      return (s?.check ? s.check.state : cached[p]) !== "not-deployable";
    },
    tone(v) { const p = projectOf(v); return p ? summary(p).tone : ""; },
    /** Read what Space says about the view's project, once in a while. */
    ensure(v) { const p = projectOf(v); if (p) load(p); },
    /** The header's Deploy: what the project's deploy is doing, at a glance; it opens the panel's section. */
    button(v, open) {
      const p = projectOf(v);
      if (!p || !this.has(v)) return "";
      const sm = P.get(p)?.check ? summary(p) : { tone: "", words: "" };
      const busy = sm.tone === "work";
      const label = busy ? "Deploying" : "Deploy";
      const tip = sm.tone === "go" ? `Live at ${sm.host}` : sm.tone === "stop" ? `${sm.words}: open Launchpad in the panel` : sm.tone === "need" ? "Launchpad waits for you" : busy ? `${sm.words} on Launchpad` : "Deploy on Launchpad";
      return `<button type="button" class="tw-act lp-btn${sm.tone ? ` t-${sm.tone}` : ""}${open ? " is-on" : ""}" data-lp-open aria-pressed="${!!open}" aria-controls="stage" title="${esc(tip)}">${busy ? '<i class="lp-arc" aria-hidden="true"></i>' : LP_ICON.rocket}<span>${label}</span></button>`;
    },
  };
}
