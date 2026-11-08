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
import { appState, nextStep, formKey, launchpadUrl, sizeWords } from "./lpapi.js";
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
const SLUG = /^[a-z0-9]([a-z0-9-]{0,23}[a-z0-9])?$/; // Space's NAME_RE: 1–25
const CACHE = "xo-lp-state"; // project → its last check's state only (no values, no secrets), so the button doesn't flicker
const AGAIN_MS = 5 * 60e3, ERR_MS = 60e3;

const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; };
const ago = (at) => { const m = Math.round((Date.now() - at) / 60e3); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const since = (at) => `<span class="elapsed" data-since="${at}">${clock(Date.now() - at)}</span>`;
/** An address Launchpad gave, in two parts: its first label (the app's own) and the rest, quieter. Only ever an
 *  address Space reported (the app's url): never one built from the name (API.md). */
const split = (host) => { const i = String(host || "").indexOf("."); return i < 0 ? [host || "", ""] : [host.slice(0, i), host.slice(i)]; };
/** Where Space found a value, in a few words ("Dockerfile EXPOSE" → "the Dockerfile"). */
const where = (src) => (/^Dockerfile/.test(src) ? "the Dockerfile" : /^package\.json/.test(src) ? "package.json" : /^default/.test(src) ? "the default" : src);
const cap = (t) => { t = String(t || ""); return /^\S*[./]/.test(t) ? t : t.replace(/^./, (x) => x.toUpperCase()); }; // a file name keeps its case
const sizeText = (c, name, label = "") => sizeWords(c.sizes?.tiers.find((t) => t.name === name), label) || name || "";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 25).replace(/-+$/, "");

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
  const S = { el: null, hs: null, ha: null, body: null, key: "", html: "", v: null, shown: null };

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
      // once preflight has answered, a refresh asks it again on the fresh check: check alone would put its guesses
      // (origin usable, GitHub able, the app Live) back over what GitHub and Launchpad said
      let c = await api.check(p);
      if (s.pre === 2 && api.preflight) c = await api.preflight(p, s.form?.name);
      s.check = c; s.at = Date.now();
      if (!s.form) s.form = { name: slug(c.name || p), port: c.port ? String(c.port) : "", repo: c.repo?.create || slug(p), env: {}, errs: {}, size: c.size || "", disk: !!c.storage, diskPath: c.storage?.path || "", diskGb: String(c.storage?.gb || 2) };
      if (c.running && !s.run && c.running !== s.ended) watch(p); // never the run Space just said was over
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
      r.live = { host: e.host, url: e.url, release: e.release, commit: e.commit, at };
      const was = s.check?.app || {};
      // the run keeps the app's id: a preflight that started before the deploy finished answers after it, with the
      // check from before, and must not take the link away (Astra on a93a2c4)
      r.appId = e.app?.id || r.appId || was.id || "";
      // the names this deploy carried are set on Launchpad now (their values went with the request, never kept here)
      const env = (s.check?.env || []).map((x) => (r.sent?.includes(x.name) ? { ...x, set: true } : x));
      // its size and disk: what it had, else what this deploy made it with (preflight says Launchpad's own soon after)
      const made = r.made || {};
      s.check = { ...s.check, state: "linked", env, app: { id: e.app?.id || r.appId || was.id || "", name: e.app?.name || was.name, url: e.url, host: e.host, status: "live", release: e.release, at, commit: e.commit || was.commit,
        size: was.size || made.size || "", sizeLabel: was.sizeLabel || "", storage: made.storage !== undefined ? made.storage : was.storage } };
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
    if (e.type === "warning") { if (e.message && !(s.warn || []).includes(e.message)) s.warn = [...(s.warn || []), e.message]; changed(); return; }
    if (e.type === "app") { s.run.appId = e.id; return; } // Space created the app: its id, for Open in Launchpad
    if (e.type === "replaced") { s.run.stop?.stop(); watch(p); changed(); return; } // a deploy started elsewhere: follow it
    if (e.type === "lost") { // the stream couldn't be picked up again: what was moving stops moving, and it's said
      s.run.lost = true;
      for (const st of Object.values(s.run.steps)) if (st.state === "doing") st.state = "paused";
      changed(); return;
    }
    if (e.type === "ended") { s.ended = e.run; s.run = null; s.pre = 0; load(p, true); changed(); return; } // the run is over: show where it left things
    if (e.type === "needs") {
      s.run = null;
      if (e.code === "name_taken") f.errs = { name: "Taken on Launchpad.", nameFix: e.data.suggestion };
      else if (e.code === "port_missing") f.errs = { port: "Which port does it listen on?" };
      else if (e.code === "repo_name_taken") { f.repo = e.data.suggestion || f.repo; f.repoChosen = true; f.errs = { repo: "That name holds other code on your GitHub." }; }
      else if (e.code === "create_repo") s.check = { ...s.check, repo: { ...s.check.repo, admin: false, why: e.data.reason || s.check.repo.why } };
      else s.needs = e; // repo_name_taken, link_existing, app_missing: a decision, lit, above the form
      S.key = ""; changed();
      if (f.errs.name || f.errs.port) requestAnimationFrame(() => S.body?.querySelector(`[data-lp-f="${f.errs.name ? "name" : "port"}"]`)?.focus());
      return;
    }
    if (e.state === "doing" || e.state === "done" || e.state === "failed") f.env = {}; // under way: the values have gone with the request
    // the stop we asked for, confirmed by the run itself
    if (e.state === "failed" && e.error?.code === "cancelled" && (s.run.stopSent || s.run.stopErr)) { stopped(p, s.run); return; }
    if (e.state === "failed" && e.error?.code === "size_not_allowed") {
      s.run = null; f.errs = { size: "Launchpad doesn't allow this size for this app. Pick another." }; S.key = "";
      announce("Launchpad doesn't allow that size for this app. Pick another."); changed();
      requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="size"]')?.focus());
      return;
    }
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
    if (s.picking || s.linking) return "pick";
    if (s.device) return "device";
    // a deploy that went live in this tab keeps its run (its address, release, app id); Change opens the settings over it
    if (s.run) return s.run.undo ? "undo" : s.run.error ? "failed" : s.run.live ? (s.editing && c.app ? "setup" : "live") : s.run.lost ? "lost" : "run";
    if (c.state === "needs-agent" && (c.getting || s.asked || findThread(p))) return "getting";
    if (c.state === "needs-agent") return "needs";
    if (s.needs) return "setup"; // a decision the deploy stopped on, linked app or not (app_missing)
    if (c.app && !s.editing) return "live";
    return "setup";
  }

  /** The head's few words, its tone, and the light's. */
  function summary(p) {
    const s = proj(p), r = s.run;
    const sc = s.editing && screen(p) === "setup" ? "live" : screen(p); // its settings open: the app still runs as it was
    switch (sc) {
      case "checking": return { tone: "", words: "Checking…" };
      case "check-failed": return { tone: "", words: "Couldn't check" };
      case "setup": case "pick": return { tone: "", words: "Not deployed", cta: true };
      case "needs": return { tone: "", words: "Not ready yet", cta: true };
      case "getting": return { tone: "work", words: "Getting ready", at: (s.check.getting || s.asked || findThread(p)).since };
      case "device": return { tone: "need", words: "Waiting for GitHub" };
      case "undo": return { tone: "work", words: "Starting" };
      case "lost": return { tone: "", words: "Lost touch" };
      case "run": { const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo"; return { tone: "work", words: WORD[on], at: r.startedAt }; }
      case "failed": return { tone: NEEDS_YOU.has(r.error.code) ? "need" : "stop", words: failWords(r.error) };
      case "live": {
        const a = r?.live || s.check.app, st = String(a.status || "");
        if (a.gone) return { tone: "stop", words: "App deleted on Launchpad" };
        const [tone, words] = st ? appState(st) : ["go", "Live"]; // no status yet (before preflight): it was live when linked
        return { tone, words, host: a.host, url: a.url };
      }
      default: return { tone: "", words: "" };
    }
  }
  const failWords = (e) => ({ build_failed: "Build failed", build_timeout: "Build is slow", health_check_failed: "Didn't go live", release_failed: "Didn't go live", release_timeout: "Release is slow", github_workflow_scope: "Needs GitHub", github_not_connected: "Needs GitHub", github_token_invalid: "Needs GitHub", push_rejected: "Push refused", remote_ahead: "Push refused", launchpad_unreachable: "Launchpad didn't answer", github_unreachable: "GitHub didn't answer", launchpad_limit: "App limit reached", launchpad_forbidden: "Launchpad said no", cancelled: "Stopped" })[e.code] || "Didn't deploy";

  // ── the system view: the app as it runs, after the Launchpad demo ───────────────
  // Visitors reach its address, the address routes to the running app, and the release's image feeds it: four
  // nodes, top to bottom in the panel (side by side when the panel is wide). Before a deploy it's the preview,
  // drawn from the check and the form; during one, the same nodes light up as the deploy reaches them; after, it's
  // what runs. Only what Space says is drawn: nothing here is invented to fill a card.
  function system(p, mode) {
    const s = proj(p), c = s.check, f = s.form, r = s.run;
    const admin = c.repo && (c.repo.admin || !c.github?.connected);
    const app = r?.live || (mode === "live" ? c.app : null);
    const real = app?.host || "";
    const [mine, domain] = real ? split(real) : ["", ""];
    const port = f.port || "—";
    const name = esc(f.name || c.app?.name || nameOf(p));
    // how each part stands
    let img = "plan", inst = "plan", addr = "plan", imgText = "", instText = "", instWord = "On launch", imgAt = 0, instAt = 0;
    if (mode === "live") {
      const [tone, words] = c.app?.status && !r?.live ? appState(c.app.status) : ["go", "Live"];
      img = "ready";
      inst = { go: "ready", work: "starting", stop: "failing" }[tone] || "none";
      instWord = { go: "Serving", work: "Rolling out", stop: "Not ready" }[tone] || words;
      addr = tone === "go" ? "on" : "off";
    } else if (mode === "run") {
      const st = (n) => r?.steps[n] || {};
      const build = st("build"), repo = st("repo"), rel = st("release"), live = st("live");
      // out of touch, nothing is drawn as under way: a step it last saw is paused, not spinning (Astra on 447edb6)
      img = build.state === "failed" || repo.state === "failed" ? "failed" : build.state === "done" ? "ready" : r.lost ? (build.state || repo.state ? "paused" : "todo") : build.state === "doing" || repo.state === "doing" || repo.state === "done" ? "building" : "todo";
      const logs = build.url ? ` · <a class="lp-ln" href="${esc(build.url)}" target="_blank" rel="noopener">Logs</a>` : "";
      const said = (t) => t && r.error && (t === r.error.text || t === r.error.message); // the headline says it already
      imgText = build.state === "doing" ? `On GitHub Actions${logs}` : build.state === "paused" ? `Was building when XO lost touch${logs}` : build.state ? `${said(build.text) ? "Didn't build" : esc(build.text || "")}${logs}` : repo.text ? (said(repo.text) ? "Didn't push" : esc(repo.text)) : "";
      imgAt = build.state === "doing" ? build.at : repo.state === "doing" ? repo.at : 0;
      inst = rel.state === "failed" ? "failing" : rel.state === "done" ? "ready" : rel.state === "doing" ? "starting" : rel.state === "paused" ? "paused" : "none";
      instWord = { failing: "Not ready", ready: "Serving", starting: "Starting", paused: "Paused", none: "Waits for the image" }[inst];
      instText = rel.state === "failed" ? (said(rel.text) ? "" : esc(rel.text || "")) : rel.of ? `${rel.ready} of ${rel.of} ready` : "";
      instAt = rel.state === "doing" ? rel.at : 0;
      addr = live.state === "done" ? "on" : c.app ? "on" : "off"; // an app already live keeps serving while the new release rolls out
    }
    const gh = !c.github ? "" : !c.github.connected ? "GitHub isn't connected" : !c.github.workflow ? "GitHub needs the workflow permission" : "";
    if (mode === "preview" && gh) img = "need";
    const release = r?.release || app?.release || c.app?.release;
    const commit = (r?.live?.commit || c.app?.commit || "");
    const at = app?.at || c.app?.at;
    const ready = r?.steps?.release?.ready ?? c.app?.ready, of = r?.steps?.release?.of ?? c.app?.of;
    const clock = (t) => (t ? `<span class="lp-tm">${since(t)}</span>` : "");
    const light = (x) => (x === "starting" || x === "building" ? '<i class="lp-arc" aria-hidden="true"></i>' : `<i class="lpv-light ${x}" aria-hidden="true"></i>`);
    const line = (cls) => `<span class="lpv-link ${cls}" aria-hidden="true"></span>`;
    const on = addr === "on";
    // the nodes
    const visitors = `<div class="lpv-vis"><span class="lpv-orb${on ? " on" : ""}">${ICON.globe}</span><span class="lpv-cap">Visitors</span></div>`;
    const address = `<div class="lpv-card lpv-addr ${mode === "preview" ? "plan" : on ? "on" : "off"}">` +
      `<div class="lpv-h">${LP_ICON.link}<span>Address</span>${real ? `<span class="lpv-acts"><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button><a class="lp-ib" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open it" aria-label="Open it">${LP_ICON.out}</a></span>` : ""}</div>` +
      `<div class="lpv-host">${real ? `<b>${esc(mine)}</b><span>${esc(domain)}</span>` : `<b>Launchpad's</b><span>given when it's created</span>`}</div>` +
      `<div class="lpv-tags"><span class="lpv-tag">HTTPS</span></div></div>`;
    const instance = `<div class="lpv-card lpv-inst ${inst}">` +
      `<div class="lpv-top">${light(inst)}<b>${name}</b><span class="lpv-st ${inst}">${esc(instWord)}</span></div>` +
      `<div class="lpv-facts">${mode === "preview" ? `<span>1 instance</span><span>port ${esc(port)}</span>` : `${release ? `<span>Release #${release}</span>` : ""}${of ? `<span>${ready} of ${of} ready</span>` : ""}${instText && !of ? `<span>${instText}</span>` : ""}<span>port ${esc(port)}</span>${clock(instAt)}`}</div></div>`;
    const repoLine = admin ? `${esc(c.repo.full)} · ${esc(c.repo.branch || "main")}` : `<span title="You're not an admin on ${esc(c.repo.full)}, so Launchpad can't add its build there">a private copy in your GitHub</span> <span class="lp-new">new</span>`;
    const image = `<div class="lpv-card lpv-img ${img}">` +
      `<div class="lpv-h">${LP_ICON.image}<span>Image</span>${clock(imgAt)}</div>` +
      (mode === "live" && release ? `<div class="lpv-rel">Release #${release}</div><div class="lpv-meta">${commit ? `<code>${esc(commit)}</code>` : ""}<span>GitHub build${at ? ` · ${ago(at)}` : ""}</span></div>`
        : `<div class="lpv-rel">${mode === "preview" ? "Built by GitHub Actions" : { ready: "Built", failed: "Didn't build", building: r?.steps?.build?.state ? "Building" : "Pushing to GitHub", paused: "Paused", todo: "Waits for the push" }[img] || ""}</div>` +
          (mode !== "preview" && imgText ? `<div class="lpv-meta">${imgText}</div>` : "")) +
      `<div class="lpv-meta">${img === "need" ? `<span class="lpv-need">${gh}</span>` : `<span>from ${repoLine}</span>`}</div></div>`;
    const fed = img === "failed" ? "err" : inst === "starting" || img === "building" ? "flow" : img === "ready" && (inst === "ready" || inst === "starting") ? "feed" : "ghost";
    const toAddr = on ? "ok" : "ghost", toApp = on && inst === "ready" ? "ok" : inst === "failing" ? "err" : "ghost";
    // the panel: the same system as one row of four small lit nodes (the demo's mini flow), what matters under it
    const node = (st, icon, label, title, cls = "") => `<span class="lpm-n ${st}${cls}" title="${esc(title)}"><i class="lpm-t">${icon}${st === "starting" || st === "building" ? '<i class="arc"></i>' : ""}</i><b>${label}</b></span>`;
    const mline = (cls) => `<span class="lpm-l ${cls}" aria-hidden="true"></span>`;
    const appTitle = `${f.name || c.app?.name || nameOf(p)}: ${instWord}`;
    const detail = mode === "live" && real
      ? `<div class="lpm-addr${addr === "on" ? "" : " is-off"}"><a class="lpm-host" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open ${esc(real)}"><b>${esc(mine)}</b><span>${esc(domain)}</span></a><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button><a class="lp-ib" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open it" aria-label="Open it">${LP_ICON.out}</a></div>` +
        `<p class="lpm-meta">${release ? `<span>Release #${release}</span>` : ""}${commit ? `<code>${esc(commit)}</code>` : ""}<span>GitHub build${at ? ` · ${ago(at)}` : ""}</span>${of ? `<span>${ready} of ${of} ready</span>` : ""}</p>`
      : mode === "preview"
        ? `<p class="lpm-meta"><span class="lpm-k">Image</span>${img === "need" ? `<span class="lpv-need">${gh}</span>` : `<span>from ${repoLine}</span>`}</p>`
        : inst === "starting" || inst === "failing" ? `<p class="lpm-meta"><span class="lpm-k">${name}</span><span>${esc(instWord)}</span>${of ? `<span>${ready} of ${of} ready</span>` : instText ? `<span>${instText}</span>` : ""}${clock(instAt)}</p>`
        : imgText || imgAt ? `<p class="lpm-meta"><span class="lpm-k">Image</span><span>${imgText}</span>${clock(imgAt)}</p>` : "";
    const mini = `<div class="lpm" data-mode="${mode}" role="img" aria-label="${esc(`${nameOf(p)}: visitors, its address, the app (${instWord}), the image`)}"><div class="lpm-row">` +
      node(on ? "on" : mode === "preview" ? "plan" : "off", ICON.globe, "Visitors", "Visitors") + mline(toAddr) +
      node(mode === "preview" ? "plan" : on ? "on" : "off", LP_ICON.link, "Address", real || "Its address on Launchpad") + mline(toApp) +
      node(inst, LP_ICON.app, name, appTitle, " lpm-app") + mline(fed) +
      node(img, LP_ICON.image, "Image", img === "need" ? gh : "The image GitHub Actions builds") + `</div>${detail}</div>`;
    // full size: the demo's own cards, side by side
    const cards = `<div class="lpv" data-mode="${mode}" role="img" aria-label="${esc(`How ${nameOf(p)} runs: visitors, its address, the app, the image`)}">` +
      visitors + line(toAddr) + address + line(toApp) + instance + line(fed) + image + `</div>`;
    // the environment, under either view: how many of its names are set on Launchpad (names only), and Change
    // what it runs on: the size it was made with, and its disk if it has one
    // the settings (Change) hang off the last line they cover: the environment's, else the machine's, so an app with
    // a disk and no environment can still grow it (Astra on b33d3eb)
    const hasEnv = !!(mode === "live" && real && c.env?.length), change = `<button type="button" class="lp-a" data-lp="edit">Change</button>`;
    const ca = c.app, machine = mode === "live" && real && ca && (ca.size || ca.sizeLabel) ? `<p class="lpm-meta lpm-env"><span class="lpm-k">Machine</span><span>${esc(sizeText(c, ca.size, ca.sizeLabel))}</span>${ca.storage ? `<span>${esc(String(ca.storage.gb))} GB disk at <code>${esc(ca.storage.path)}</code></span>` : ""}${hasEnv ? "" : change}</p>` : "";
    const env = machine + (hasEnv ? `<p class="lpm-meta lpm-env"><span class="lpm-k">Environment</span><span>${c.env.filter((x) => x.set).length} of ${c.env.length} set on Launchpad</span><button type="button" class="lp-a" data-lp="edit">Change</button></p>` : "");
    return mini + cards + env;
  }

  /** The demo's headline: the state in one word or a few, large, and what it means in a sentence */
  const hero = (word, sentence, tone = "") => `<div class="lpv-hero"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${word}</h3>${sentence ? `<p class="lp-p">${sentence}</p>` : ""}</div>`;
  const span = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  /** A decision's own lit button above the form: not when the form is the answer (settings), nor done outside */
  const lit = (nd) => { const a = nextStep(nd.action); return a && a[1] !== "settings" && a[1] !== "retry" && a[1] !== "log" ? a : null; };
  const fixOf = (e) => (e.fix ? `<p class="lp-note">${esc(e.fix)}</p>` : "");
  /** Space's next step as the lit button; done outside the panel, only a quiet way back once it's done */
  const actionHtml = (e) => {
    const a = nextStep(e.action);
    if (!a) return e.action === "none" ? "" : `<div class="lp-acts"><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Deploy again once that's done</span></button></div>`;
    if (a[1] === "log") return e.url ? `<div class="lp-acts"><a class="lp-go" href="${esc(e.url)}" target="_blank" rel="noopener"><span>${a[0]}</span>${LP_ICON.out}</a></div>` : "";
    return `<div class="lp-acts"><button type="button" class="lp-go" data-lp="${a[1]}">${a[1] === "reconnect" ? LP_ICON.github : a[1] === "retry" ? ICON.retry : ""}<span>${a[0]}</span></button></div>`;
  };
  /** A gh login on this machine without `workflow`: Space's command, to copy, and a way to check again. */
  const ghCmd = (fix) => /`([^`]+)`/.exec(fix || "")?.[1] || "";
  const cmdHtml = (cmd) => `<div class="lp-cmd"><code>${esc(cmd)}</code><button type="button" class="lp-ib" data-lp="cmd-copy" data-v="${esc(cmd)}" title="Copy the command" aria-label="Copy the command">${ICON.copy}</button></div>`;

  const head = (h, p, tone = "") => `<div class="lp-hd"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${h}</h3>${p ? `<p class="lp-p">${p}</p>` : ""}</div>`;
  const rec = (title, text, act, label, icon = "") => `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>${title}</b><p>${text}</p></div><button type="button" class="lp-go" data-lp="${act}">${icon}<span>${label}</span></button></div>`;

  function setupHtml(p) {
    const s = proj(p), c = s.check, f = s.form, e = f.errs || {};
    const scope = c.github && c.github.connected && c.github.workflow;
    const guessed = c.state === "detectable";
    const env = c.env || [];
    const from = [...new Set(env.map((x) => x.source).filter(Boolean))].join(", ");
    const mine = env.filter((x) => x.sensitive || !x.default || f.env[x.name] || s.envAll || (s.editing && c.app)), rest = env.length - mine.length;
    const nd = s.needs;
    const editing = !!(s.editing && c.app);
    return (editing ? head(`${esc(nameOf(p))}'s settings`, `Change what you need; ${c.behind ? `it deploys again with them, and with ${esc(c.repo.branch || "main")}'s commits since the live release` : "the live commit is built again with them"}. Values left empty stay as they are on Launchpad.`)
      : head(`Put ${esc(nameOf(p))} on the web`, guessed ? "Found these in the project. Check them, then deploy." : "Launchpad builds it on every push and runs it.")) +
      (nd ? `<div class="lp-rec lp-ask"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}One thing first</span><b>${esc(nd.message || "")}</b>${nd.fix ? `<p>${esc(nd.fix)}</p>` : ""}</div>${lit(nd) ? `<button type="button" class="lp-go" data-lp="${lit(nd)[1]}"><span>${lit(nd)[0]}</span></button>` : ""}</div>` : "") +
      (c.blockers.length ? `<p class="lp-note t-need">Deploy would stop here: ${esc(c.blockers.join("; "))}.</p>` : "") +
      (editing ? "" : system(p, "preview")) +
      (c.github.source === "gh" && c.github.connected && !c.github.workflow && ghCmd(c.github.fix) ? `<div class="lp-gh"><p class="lp-note">Or grant it to this machine's gh login, then check again:</p>${cmdHtml(ghCmd(c.github.fix))}<div class="lp-alt lp-left"><button type="button" class="lp-a" data-lp="recheck-gh">${ICON.retry}<span>I ran it: check again</span></button></div></div>` : "") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src" title="This thread's work goes out once it's merged into ${esc(c.repo.branch || "main")}">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b>, not this thread's branch.</span></p>` : "") +
      `<div class="lp-set">` +
      (editing ? "" : field("name", "Name", f.name, { hint: e.name || "It can't change later.", bad: !!e.name, fix: e.nameFix })) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${esc(where(c.portFrom))}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      machineRows(s, c, f, e, editing) +
      (e.repo ? field("repo", "Repository", f.repo, { hint: e.repo, bad: true }) : "") +
      `</div>` +
      (env.length ? `<fieldset class="lp-env"><legend><span>Environment</span>${from ? `<small>from ${esc(from)}</small>` : ""}</legend>` +
        mine.map((x) => `<label class="lp-f lp-ev"><span class="lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><input class="lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(editing ? (x.set ? "Set · leave to keep" : x.default || "Not set") : x.default || "")}" aria-label="${esc(x.name)}"></label>`).join("") +
        (rest ? `<button type="button" class="lp-a lp-more" data-lp="env-all"><span>${rest} more with example values</span>${ICON.chevron || ""}</button>` : "") +
        `<p class="lp-lock">${ICON.lock}<span>Straight to Launchpad; XO never keeps them.</span></p></fieldset>` : "") +
      `<div class="lp-foot">` + (scope
        ? `<button type="button" class="lp-go lp-wide${nd && lit(nd) ? " is-quiet" : ""}" data-lp="deploy">${LP_ICON.rocket}<span>${editing ? "Deploy with these" : `Deploy ${esc(f.name || nameOf(p))}`}</span></button>`
        : `<button type="button" class="lp-go lp-wide" data-lp="reconnect">${LP_ICON.github}<span>${c.github.connected ? "Reconnect GitHub" : "Connect GitHub"}</span></button>`) +
      (editing ? `<div class="lp-alt"><button type="button" class="lp-a" data-lp="edit-cancel"><span>Cancel</span></button></div></div>`
        : `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick">${LP_ICON.link}<span>Link an app already on Launchpad</span></button></div></div>`);
  }
  /** The machine: for a new app, its size (only what the template allows, its default chosen) and an optional disk;
   *  in a linked app's settings, the size it was made with (fixed) and its disk, which can grow but never shrink. */
  function machineRows(s, c, f, e, editing) {
    const ids = (id) => `aria-describedby="lp-h-${id}"${e[id] ? ' aria-invalid="true"' : ""}`;
    const row = (label, inner, bad = false, tag = "div") => `<${tag} class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span>${inner}</${tag}>`;
    const hint = (id, text) => `<span class="lp-hint" id="lp-h-${id}">${text}</span>`;
    if (editing) {
      const a = c.app;
      return (a.size || a.sizeLabel ? row("Size", `<span class="lp-v"><span class="lp-ro">${esc(sizeText(c, a.size, a.sizeLabel))}</span>${hint("size", "Fixed when it was created.")}</span>`) : "") +
        (a.storage === undefined ? "" : a.storage
          ? row("Disk", `<span class="lp-v"><span class="lp-pair"><input class="lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u lp-at">GB at <code>${esc(a.storage.path)}</code></span></span>${hint("disk", e.disk || "Grows, never shrinks.")}</span>`, !!e.disk, "label")
          : row("Disk", `<span class="lp-v"><span class="lp-ro">None</span>${hint("disk", "Can't be added after creation.")}</span>`));
    }
    // a Space that offers sizes (xo-space 3886701 on): folded to one line until you change it; an older one, nothing
    const z = c.sizes, at = f.size || z?.def || "";
    if (!z) return "";
    if (!(s.machine || e.size || e.disk)) {
      const t = z.tiers.find((x) => x.name === at);
      return row("Machine", `<span class="lp-v is-row"><span class="lp-ro">${esc(t ? `${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB` : "Launchpad's default")}${f.disk ? ` · ${esc(f.diskGb)} GB disk` : ""}</span><button type="button" class="lp-a lp-chg" data-lp="machine-open" aria-label="Change the machine">Change</button></span>`);
    }
    return (z ? row("Size", `<span class="lp-v"><span class="lp-selw"><select class="lp-in lp-sel" data-lp-f="size" aria-label="Size" ${ids("size")}>${z.def ? "" : `<option value=""${at ? "" : " selected"}>Launchpad's default</option>`}` +
        z.tiers.map((t) => `<option value="${esc(t.name)}"${at === t.name ? " selected" : ""}>${esc(`${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB`)}</option>`).join("") +
        `</select>${ICON.chevron}</span>${hint("size", e.size || sizeHint(c, f))}</span>`, !!e.size, "label") : "") +
      (f.disk
        ? row("Disk", `<span class="lp-v"><span class="lp-pair"><input class="lp-in lp-mono" data-lp-f="diskPath" value="${esc(f.diskPath)}" placeholder="/data" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Where the disk is mounted" ${ids("disk")}><input class="lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u">GB</span><button type="button" class="lp-ib" data-lp="disk-remove" title="No disk" aria-label="No disk">${ICON.close}</button></span>${hint("disk", e.disk || "Grows later, never shrinks.")}</span>`, !!e.disk)
        : row("Disk", `<span class="lp-v is-row"><button type="button" class="lp-a lp-add" data-lp="disk-add">${ICON.plus}<span>Add a disk</span></button>${hint("disk", "Only at creation")}</span>`));
  }
  const sizeHint = (c, f) => (c.sizes?.def && (f.size || c.sizes.def) === c.sizes.def ? "The default; fixed once created." : "Fixed once it's created.");
  function field(id, label, value, { hint = "", bad = false, mode = "text", short = false, fix = "" } = {}) {
    return `<label class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span><span class="lp-v${short ? " is-row" : ""}"><input class="lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><span class="lp-hint" id="lp-h-${id}">${hint}${fix ? ` <button type="button" class="lp-a lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span></span></label>`;
  }

  /** What Space warned of on the way (uncommitted changes left out, env names with no value): worth reading, not fatal. */
  const warnHtml = (s) => (s.warn || []).map((w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("");

  function runHtml(p) {
    const s = proj(p), r = s.run, name = esc(s.form.name || nameOf(p));
    if (r.undo) return hero("Starting", `Deploying ${name} in <span class="lp-count" data-until="${r.undo}">${Math.max(1, Math.ceil((r.undo - Date.now()) / 1000))}</span> s.`, "work") + system(p, "run") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="undo">${ICON.rewind || ICON.retry}<span>Undo</span></button></div>`;
    const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo", rel = r.steps.release || {};
    const word = { repo: "Pushing", build: "Building", release: `Rolling out${r.release ? ` #${r.release}` : ""}`, live: "Going live" }[on];
    const sentence = on === "release" && rel.of
      ? `${rel.ready} of ${rel.of} new instance${rel.of > 1 ? "s" : ""} ${rel.of > 1 ? "are" : "is"} ready.${s.check.app?.release ? ` Release #${s.check.app.release} keeps serving until the new one is healthy.` : ""}`
      : `${{ repo: `Pushing ${esc(s.check.repo.branch || "main")} to GitHub`, build: "GitHub Actions is building the image", release: "Launchpad is starting the new release", live: "Going live" }[on]} · ${since(r.startedAt)} in all`;
    const halting = !!(r.stopping || r.stopSent);
    const q = r.stopErr ? `<p class="lp-q t-need" role="status">Couldn't stop it: ${esc(r.stopErr)}. It's still deploying.</p>`
      : r.stopSent ? `<p class="lp-q" role="status">Stopping… it stops once Space confirms.</p>` : `<p class="lp-q">Carries on if you close this.</p>`;
    return hero(word, sentence, "work") + system(p, "run") + warnHtml(s) +
      `<div class="lp-acts">${q}<button type="button" class="lp-b" data-lp="stop"${halting ? ' aria-disabled="true"' : ""}><span>${halting ? "Stopping…" : r.stopErr ? "Stop again" : "Stop"}</span></button><button type="button" class="lp-b" data-lp="hide"><span>Hide</span></button></div>`;
  }

  /** The stream dropped and couldn't be picked up: the deploy carries on in Space, nothing here spins */
  function lostHtml(p) {
    return hero("Lost touch", "The deploy carries on in Space. Follow it again to see where it is.") + system(p, "run") +
      `<div class="lp-acts"><button type="button" class="lp-go" data-lp="rewatch">${ICON.retry}<span>Follow it again</span></button></div>`;
  }

  function liveHtml(p) {
    const s = proj(p), a = s.run?.live || s.check.app, name = esc(s.form?.name || nameOf(p));
    const appUrl = launchpadUrl(s.run?.appId || s.check.app?.id);
    if (a.gone) return head(`${name}'s app is gone`, "It was deleted on Launchpad. Its repository, port and settings are still here.", "stop") +
      rec("Create it again", "A new app from the same repository, with the same settings.", "recreate", "Create it again", LP_ICON.rocket) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="unlink"><span>Unlink</span></button></div>`;
    const [tone, words] = a.status && !s.run?.live ? appState(a.status) : ["go", "Live"];
    const of = s.check.app?.of || 1, ready = s.check.app?.ready ?? of, rel = a.release || s.check.app?.release;
    const sentence = tone === "go"
      ? `${rel ? `Release #${rel}` : name} has served${a.at ? ` for ${span(Date.now() - a.at)}` : ""} on ${ready} of ${of} instance${of > 1 ? "s" : ""}.`
      : tone === "work" ? `A new release is rolling out${rel ? `; release #${rel} keeps serving until it's healthy` : ""}.` : tone === "stop" ? "Its instances aren't answering. Deploying again, or the logs in Launchpad, say why." : `${name} isn't serving.`;
    return hero(tone === "go" ? "Live" : words, sentence, tone) +
      system(p, "live") + (s.run?.live ? warnHtml(s) : "") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="again">${LP_ICON.rocket}<span>Deploy again</span></button>${appUrl ? `<a class="lp-b" href="${esc(appUrl)}" target="_blank" rel="noopener"><span>Open in Launchpad</span>${LP_ICON.out}</a>` : ""}` +
      `<span class="lp-mw"><button type="button" class="lp-ib" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-menu" role="menu"><button type="button" role="menuitem" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span></div>`;
  }

  function failedHtml(p) {
    const s = proj(p), e = s.run.error, name = esc(s.form.name || nameOf(p));
    if (e.code === "build_failed") return hero("The build failed", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", "stop") +
      system(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", LP_ICON.rocket) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button>${e.url ? `<a class="lp-b" href="${esc(e.url)}" target="_blank" rel="noopener"><span>Logs on GitHub</span>${LP_ICON.out}</a>` : ""}</div>`;
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return hero(`${e.release ? `Release #${e.release}` : name} didn't go live`, `Nothing answers on port ${e.port}: the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "stop") +
      system(p, "run") +
      rec(`Use port ${e.declared}`, `The image listens on ${e.declared}; the app sends traffic to ${e.port}.`, "fix-port", `Use port ${e.declared}`);
    if (NEEDS_YOU.has(e.code)) return hero(e.code === "github_workflow_scope" ? "GitHub needs one more permission" : "GitHub isn't connected", e.code === "github_workflow_scope" ? "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes." : esc(e.message || ""), "need") +
      system(p, "run") + (e.source === "gh" && ghCmd(e.fix)
        ? `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>Grant it to this machine's gh login</b><p>Run this, then check again.</p></div>${cmdHtml(ghCmd(e.fix))}<button type="button" class="lp-go" data-lp="recheck-gh">${ICON.retry}<span>I ran it: check again</span></button></div>` +
          `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="reconnect">${LP_ICON.github}<span>Reconnect GitHub here</span></button></div>`
        : rec("Reconnect GitHub", "Grant it once; then deploy again.", "reconnect", e.code === "github_workflow_scope" ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github));
    return hero(`${name} didn't deploy`, esc(e.message || e.text || "Something went wrong on the way."), "stop") + system(p, "run") +
      fixOf(e) + actionHtml(e);
  }

  function needsHtml(p) {
    const c = proj(p).check;
    return head(`${esc(nameOf(p))} needs preparing first`, "Launchpad can't tell how to run it as it is. An agent can prepare it.") +
      (c.missing.length ? `<ul class="lp-check">${c.missing.map((m) => `<li class="${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lp-c"><b>${esc(cap(m.what))}</b>${m.why ? `<span>${esc(m.why)}</span>` : ""}</span></li>`).join("")}</ul>` : "") +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", LP_ICON.rocket);
  }

  function gettingHtml(p) {
    const s = proj(p), g = s.check.getting || findThread(p) || s.asked;
    return head(`Getting ${esc(nameOf(p))} ready`, "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here.") +
      `<ul class="lp-ag"><li><button type="button" class="lp-agr" data-lp="thread" data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${g.done ? "" : '<i class="arc"></i>'}</span><span class="lp-c"><b>${esc(g.title)}</b><span>${g.done ? "Done: merge its work, then deploy" : "Working"}</span></span><span class="lp-m">${g.done ? "" : `<span class="lp-tm">${since(g.since)}</span>`}</span></button></li></ul>` +
      system(p, "preview");
  }

  function deviceHtml(p) {
    const d = proj(p).device;
    if (!d.code) return head("Connecting GitHub…", "A GitHub login this machine already has is used as it is.", "need") + `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Asking Space.</span></p>`;
    return head("Connect GitHub", "Enter this code on GitHub. It grants the <code>workflow</code> permission Launchpad needs.", "need") +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code><button type="button" class="lp-b" data-lp="code-copy">${d.copied ? ICON.check : ICON.copy}<span>${d.copied ? "Copied" : "Copy"}</span></button></div>` +
      `<a class="lp-go lp-wide" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a>` +
      `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Waiting for GitHub. This carries on by itself.</span></p>` +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="device-cancel"><span>Cancel</span></button></div>`;
  }

  function pickHtml(p) {
    const s = proj(p), list = s.picking?.apps;
    const wait = (w) => `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    return head("Link an app on Launchpad", `${esc(nameOf(p))} deploys to the app you pick from now on.`) +
      (s.linking ? wait("Linking…") : !list ? wait("Reading your apps…") : !list.length ? `<p class="lp-note">No apps on Launchpad yet.</p>` :
        `<ul class="lp-apps">${list.map((a) => `<li><button type="button" class="lp-appr" data-lp="link" data-id="${esc(a.id)}"${a.linkable ? "" : ` disabled title="Not built from GitHub, so XO can't deploy to it"`}><span class="lp-t">${LP_ICON.app}</span><span class="lp-c"><b>${esc(a.name)}</b><span class="lp-mono">${esc(a.host)}</span></span><span class="lp-m">${((t, w) => `<span class="lp-st t-${t}">${t === "work" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}${esc(w)}</span>`)(...appState(a.status))}</span></button></li>`).join("")}</ul>`) +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick-cancel"><span>Back</span></button></div>`;
  }

  function checkingHtml(p) {
    return head(`Checking ${esc(nameOf(p))}…`, "Its repository, its port and what it needs to run.") +
      `<div class="lpm is-skel" aria-hidden="true"><div class="lpm-row">${'<span class="lpm-n"><i class="lpm-t"></i><b></b></span><span class="lpm-l"></span>'.repeat(3)}<span class="lpm-n"><i class="lpm-t"></i><b></b></span></div></div>`;
  }

  function bodyHtml(p) {
    const sc = screen(p);
    const s = proj(p), c = s.check;
    return {
      key: `${p}|${sc}` + (sc === "setup" ? `|${formKey(c, { pre: s.pre, needs: s.needs && [s.needs.code, s.needs.message, s.needs.fix, s.needs.action], errs: s.form.errs || {}, envAll: !!s.envAll, editing: !!s.editing, machine: !!s.machine, disk: !!s.form.disk, thread: !!S.v?.startsWith("t:") })}` : ""),
      html: sc === "checking" ? checkingHtml(p) : sc === "check-failed" ? head("Couldn't check this project", esc(proj(p).err?.message || "XO Space didn't answer.")) + `<div class="lp-acts"><button type="button" class="lp-b" data-lp="recheck">${ICON.retry}<span>Try again</span></button></div>`
        : sc === "setup" ? setupHtml(p) : sc === "undo" || sc === "run" ? runHtml(p) : sc === "lost" ? lostHtml(p) : sc === "live" ? liveHtml(p) : sc === "failed" ? failedHtml(p)
        : sc === "needs" ? needsHtml(p) : sc === "getting" ? gettingHtml(p) : sc === "device" ? deviceHtml(p) : sc === "pick" ? pickHtml(p) : "",
      form: sc === "setup",
    };
  }

  /** Typed values go when the section does (closed, folded, another project shown): from memory and from the
   *  inputs, and the form is drawn afresh next time. A deploy waiting out its Undo keeps them until it sends. */
  function forget(p) {
    const s = p && P.get(p);
    if (!s?.form || s.run?.undo) return;
    s.form.env = {};
    if (S.body && projectOf(S.v) === p) for (const n of S.body.querySelectorAll("[data-lp-env]")) { n.value = ""; n.removeAttribute("value"); }
    S.key = ""; S.html = "";
  }

  // ── painting into the frame stage.js made ─────────────────────────────────
  function paint(v, open) {
    if (!S.el) return;
    const p = projectOf(v);
    if (S.shown && (S.shown !== p || !open)) forget(S.shown);
    S.shown = open && p ? p : null;
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
      // typed environment values go back into their inputs as properties, never into the markup (no value
      // attribute, nothing in outerHTML), so a redraw leaves no copy of a secret behind (Astra on 4026444)
      if (b.form) { const env = proj(p).form?.env || {}; for (const n of S.body.querySelectorAll("[data-lp-env]")) if (env[n.dataset.lpEnv]) n.value = env[n.dataset.lpEnv]; }
      if (fresh) S.body.scrollTop = 0;
      S.key = b.key; S.html = same;
      requestAnimationFrame(over);
      if (focus) { const n = S.body.querySelector(focus); if (n) { n.focus({ preventScroll: true }); if (caret && n.setSelectionRange) try { n.setSelectionRange(...caret); } catch { /* a number field */ } } }
    }
  }
  /** As you type: the card's name, address and port follow the fields, and nothing else redraws. */
  function syncPreview(p) {
    const f = proj(p).form, view = S.body.querySelector('.lpv[data-mode="preview"]');
    const sh = S.body.querySelector("#lp-h-size");
    if (sh && !f.errs?.size && sh.closest("label")?.querySelector("select")) sh.textContent = sizeHint(proj(p).check, f);
    if (!view) return;
    const set = (sel, html) => { const n = S.body.querySelector(sel); if (n && n.innerHTML !== html) n.innerHTML = html; };
    set(".lpm .lpm-app b", esc(f.name || nameOf(p)));
    set('.lpv[data-mode="preview"] .lpv-inst .lpv-top b', esc(f.name || nameOf(p)));
    set('.lpv[data-mode="preview"] .lpv-inst .lpv-facts', `<span>1 instance</span><span>port ${esc(f.port || "—")}</span>`);
    const go = S.body.querySelector('[data-lp="deploy"] span');
    if (go) go.textContent = `Deploy ${f.name || nameOf(p)}`;
  }


  // ── what you do in it ───────────────────────────────────────────────────────
  function validate(p) {
    const s = proj(p), f = s.form, c = s.check, errs = {};
    if (!SLUG.test(f.name)) errs.name = "Lowercase letters, digits and hyphens, up to 25.";
    const port = Number(f.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errs.port = "A port from 1 to 65535.";
    const editing = !!(s.editing && c?.app), gb = Number(f.diskGb), was = c?.app?.storage;
    if (!editing && c?.sizes && f.size && !c.sizes.tiers.some((t) => t.name === f.size)) errs.size = "Pick one of the sizes Launchpad offers.";
    if (!editing && f.disk) {
      if (!/^\/[^/]/.test(f.diskPath) || /(^|\/)\.\.(\/|$)/.test(f.diskPath)) errs.disk = "Where it's mounted: an absolute path other than /, like /data.";
      else if (!Number.isInteger(gb) || gb < 1 || gb > 20) errs.disk = "A size from 1 to 20 GB.";
    }
    if (editing && was && f.diskGb !== String(was.gb) && (!Number.isInteger(gb) || gb < was.gb || gb > 20)) errs.disk = gb < was.gb ? `It can't shrink: ${was.gb} GB or more, up to 20.` : `From ${was.gb} to 20 GB.`;
    f.errs = errs;
    return !Object.keys(errs).length;
  }

  function deploy(p, again = false) {
    const s = proj(p), gh = s.check?.github;
    // the app's settings (Change): always a build with them, never "nothing new to push". Space builds main as it is:
    // the live commit again (rebuild's empty commit), or main's newer commits when it has moved on (the form says so)
    const edit = !!(s.editing && s.check?.app);
    again = again || edit;
    if (gh && !(gh.connected && gh.workflow)) { github(p); return; }
    if (!validate(p)) {
      S.key = ""; changed();
      requestAnimationFrame(() => S.body?.querySelector('[aria-invalid="true"], .is-bad input, .is-bad select')?.focus());
      return;
    }
    s.run = newRun(); s.run.undo = Date.now() + 3e3; s.run.edit = edit; s.editing = false;
    const t = setInterval(() => {
      if (!s.run || !s.run.undo) { clearInterval(t); return; }
      const left = s.run.undo - Date.now();
      const n = S.body?.querySelector(".lp-count");
      if (n) n.textContent = String(Math.max(1, Math.ceil(left / 1000)));
      if (left <= 0) { clearInterval(t); begin(p, again); }
    }, 200);
    changed();
    announce(`Deploying ${s.form.name} in 3 seconds. Undo to stop it.`);
    requestAnimationFrame(() => S.body?.querySelector('[data-lp="undo"]')?.focus({ preventScroll: true }));
  }
  function begin(p, again = false) {
    const s = proj(p), f = s.form, c = s.check;
    const env = Object.fromEntries(Object.entries(f.env).filter(([, v]) => v !== ""));
    // a new app (or one made again): its size and disk; a linked app's settings: a larger disk, at the same path
    const creating = !c.app || f.recreate, was = c.app?.storage, gb = Number(f.diskGb);
    const machine = creating ? { ...(c.sizes && f.size ? { size: f.size } : {}), ...(f.disk ? { storage_path: f.diskPath, storage_size: gb } : {}) }
      : s.run.edit && was && gb > was.gb ? { storage_path: was.path, storage_size: gb } : {};
    s.run.made = creating ? { size: (c.sizes && (f.size || c.sizes.def)) || c.size || "", storage: f.disk ? { path: f.diskPath, gb } : null } : machine.storage_size ? { storage: { path: was.path, gb } } : {};
    const body = { name: f.name, port: Number(f.port), ...machine, ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.repoChosen ? f.repo : f.name }), ...(c.app && again && !f.recreate && (s.run.edit || !c.behind) ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((x) => x.sensitive).map((x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now(); s.run.sent = Object.keys(env); // names only: what goes live with this release
    s.needs = null; s.warn = null; f.recreate = false; // recreate is asked once, not for every deploy after
    s.run.stop = api.deploy(p, body, (e) => event(p, e));
    if (S.shown !== p) f.env = {}; // sent with the section put away: nothing here to keep them for
    changed();
  }
  const visible = (p) => S.el && !S.el.classList.contains("is-folded") && !S.el.hidden && S.v && projectOf(S.v) === p && document.body.classList.contains("stage-open");

  /** Reconnect GitHub with the workflow scope: Space's device flow, polled until it's granted. */
  async function github(p) {
    const s = proj(p);
    s.device = { code: "", url: "", copied: false };
    changed();
    try {
      const gh = s.check.github;
      const d = await api.githubStart(gh.connected && gh.source === "connections");
      if (!s.device) return; // cancelled meanwhile
      if (d.connected) { s.device = null; s.pre = 0; if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null; announce(`GitHub is connected${d.username ? ` as ${d.username}` : ""}${d.imported ? ", from this machine's gh login" : ""}.`); changed(); preflight(p); return; }
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
          announce("GitHub is connected.");
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
    try { const apps = await api.apps(p); if (s.picking) s.picking.apps = apps; } // Back meanwhile: nothing to fill
    catch (e) { s.picking = null; notify && notify(`Couldn't read your Launchpad apps: ${e.message}`); }
    changed();
  }

  /** Link an app on Launchpad, then read the project afresh: lpapi's preflight builds on the last check, which
   *  doesn't know the link yet, and link answers before Launchpad has a status. */
  function link(p, id) {
    const s = proj(p);
    s.picking = null; s.linking = true; changed();
    api.link(p, id)
      .then((a) => { s.check = { ...s.check, state: "linked", app: a }; s.run = null; load(p, true); })
      .catch((e) => notify && notify(`Couldn't link it: ${e.message}`))
      .finally(() => { s.linking = false; changed(); });
  }

  /**
   * Ask Space to stop the run, and say it stopped only once Space says so: DELETE answers {stopped: true} once the
   * deploy has ended (or the stream's own `error cancelled` comes first). Refused (offline, an error), the run is
   * still followed, the card says it couldn't stop, and Stop is there again. Nothing to stop: it had already ended,
   * and the stream's last event says how.
   */
  function stopNow(p, run) {
    const s = proj(p);
    if (s.run !== run) return;
    if (!api.stop) { stopped(p, run); return; }
    run.stopSent = true; run.stopErr = null; changed();
    api.stop(p).then((r) => {
      run.stopSent = false;
      if (s.run !== run) return; // the stream said first (cancelled, or how it ended)
      if (r && r.stopped === false) { announce("It had already finished."); changed(); return; }
      stopped(p, run);
    }, (e) => {
      run.stopSent = false;
      if (s.run !== run) return;
      run.stopErr = (e && e.message) || "Space didn't answer";
      announce(`Couldn't stop the deploy: ${run.stopErr}. It's still running.`);
      changed();
    });
  }
  /** The stop is confirmed: the run is over; the project as it now is. */
  function stopped(p, run) {
    const s = proj(p);
    if (s.run !== run) return;
    run.stop && run.stop.stop();
    s.run = null; s.pre = 0;
    announce("Deploy stopped.");
    load(p, true); changed();
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
        if (!s.run || s.run.stopping || s.run.stopSent) return;
        const run = s.run;
        run.stopErr = null;
        // Undo for 3 s, then the stop is asked for; the run stays followed until Space confirms it
        run.stopping = setTimeout(() => { run.stopping = 0; stopNow(p, run); }, 3000);
        notify && notify(`Stopping the deploy of ${s.form.name}`, () => { clearTimeout(run.stopping); run.stopping = 0; changed(); });
        changed();
        return;
      }
      case "cmd-copy": navigator.clipboard?.writeText(el.dataset.v).catch(() => {}); announce("Copied the command."); return;
      case "recheck-gh": s.pre = 0; if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null; announce("Checking GitHub again."); changed(); preflight(p); return;
      case "rewatch": s.run = null; watch(p); changed(); return;
      case "settings": s.run = null; s.needs = null; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelector(s.form.errs?.size ? '[data-lp-f="size"]' : '[data-lp-f="name"]')?.focus()); return;
      case "machine-open": s.machine = true; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="size"]')?.focus()); return;
      case "disk-add": s.form.disk = true; s.form.errs = { ...s.form.errs, disk: "" }; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="diskPath"]')?.focus()); return;
      case "disk-remove": s.form.disk = false; s.form.errs = { ...s.form.errs, disk: "" }; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp="disk-add"]')?.focus()); return;
      case "create-repo": s.check = { ...s.check, repo: { ...s.check.repo, admin: false } }; s.needs = null; s.run = null; deploy(p); return;
      case "link-same": { const id = s.needs?.data?.app?.id || s.run?.error?.app?.id; s.needs = null; s.run = null; if (id) api.link(p, id).then((a) => { s.check = { ...s.check, state: "linked", app: a }; deploy(p, true); }).catch((err) => notify && notify(`Couldn't link it: ${err.message}`)); changed(); return; }
      case "env-all": s.envAll = true; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelectorAll(".lp-ev input")[mine0(p)]?.focus()); return;
      case "recreate": s.form.recreate = true; s.run = null; deploy(p, true); return;
      case "edit": s.editing = true; s.form.diskGb = String(s.check.app?.storage?.gb || ""); s.form.errs = {}; s.menu = false; S.key = ""; changed(); requestAnimationFrame(() => S.body?.querySelector(".lp-ev input, [data-lp-f]")?.focus()); return;
      case "edit-cancel": s.editing = false; s.form.env = {}; S.key = ""; changed(); return;
      case "again": s.run = null; s.form.errs = {}; deploy(p, true); return; // the linked app, the same settings: 3 s, then it goes
      case "retry": s.run = null; deploy(p); return;
      case "copy": navigator.clipboard?.writeText((s.run?.live || s.check.app).url).catch(() => {}); s.copied = Date.now() + 1500; changed(); setTimeout(changed, 1600); return;
      case "menu": s.menu = !s.menu; changed(); return;
      case "unlink": {
        // Undo is real: Space unlinks (and commits launchpad.json) only once its 3 s are up
        s.menu = false; s.needs = null;
        const was = s.check, run = s.run;
        s.check = { ...was, app: null, state: "ready" }; s.run = null; changed();
        const t = setTimeout(() => api.unlink(p).then(() => load(p, true)).catch((e) => { s.check = was; notify && notify(`Couldn't unlink: ${e.message}`); changed(); }), 3200);
        notify && notify("Unlinked from Launchpad", () => { clearTimeout(t); s.check = was; s.run = run; changed(); });
        return;
      }
      case "pick": startPick(p); return;
      case "pick-cancel": s.picking = null; changed(); return;
      case "link": link(p, el.dataset.id); return;
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
      case "use-name": s.form.name = el.dataset.v; s.form.errs = {}; S.key = ""; changed(); return;
      case "recheck": s.err = null; load(p, true); changed(); return;
    }
  }
  let onOpen = null, onHide = null;

  const mine0 = (p) => { const s = proj(p), f = s.form; return (s.check.env || []).filter((x) => x.sensitive || !x.default || f.env[x.name]).length; };

  /** More below than the section shows: its foot fades rather than ending on a cut row. */
  function over() {
    const b = S.body;
    if (!b) return;
    const more = b.scrollTop + b.clientHeight < b.scrollHeight - 1;
    b.classList.toggle("is-over", more);
    b.classList.toggle("is-fade", more && !b.querySelector(".lp-foot")); // a section without a foot fades at its edge
  }

  function mount(section, { open, hide }) {
    S.el = section; S.hs = section.querySelector(".lp-hs"); S.ha = section.querySelector(".lp-ha"); S.body = section.querySelector(".fr-b");
    S.body.addEventListener("scroll", over, { passive: true });
    addEventListener("resize", over);
    onOpen = open; onHide = hide;
    section.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lp]");
      if (!b || !section.contains(b)) { if (!e.target.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) { proj(p).menu = false; changed(); } } return; }
      e.preventDefault();
      act(b.dataset.lp, b);
    });
    section.addEventListener("input", (e) => {
      const p = projectOf(S.v), t = e.target;
      if (!p || !t.matches("input, select")) return;
      const f = proj(p).form;
      if (t.dataset.lpF) f[t.dataset.lpF] = t.dataset.lpF === "name" || t.dataset.lpF === "repo" ? t.value.toLowerCase() : t.value.trim();
      if (t.dataset.lpEnv) f.env[t.dataset.lpEnv] = t.value;
      if (f.errs && Object.keys(f.errs).length) { const l = t.closest(".lp-f"); l?.classList.remove("is-bad"); t.removeAttribute("aria-invalid"); }
      syncPreview(p);
    });
    section.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches?.(".lp-in")) { e.preventDefault(); const go = S.body.querySelector(".lp-foot .lp-go"); if (go) act(go.dataset.lp, go); }
    });
  }

  return {
    mount, paint,
    /** The panel closed: what was typed in the section goes with it. */
    away() { if (S.shown) forget(S.shown); S.shown = null; },
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
