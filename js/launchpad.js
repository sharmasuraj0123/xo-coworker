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
import { esc, copyText, COPY_REFUSED } from "./util.js";
import { pointerFollows } from "./keynav.js";

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
const STOP_MS = 3000, UNLINK_MS = 3200; // Stop's and Unlink's windows: their notices' Undo lasts exactly as long

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
 * notify(text, undo, kind): a line in the herald (a deploy finishing while its section is out of sight); kind says
 * what news it is: "done" (the default), "err" for anything that failed, "halt" for a stop on its way.
 * notice(mid, line, ms) / unnotice(mid): one line per subject (a stop, an unlink), shown, then changed in place as
 * the action goes on, or taken away (the herald's mid: C041's pattern, the owner's choice B). line: {text, sub, kind,
 * undo, undoLabel, until}: until is the Undo's own deadline, the action's. onChange(): the app re-renders.
 */
export function createLaunchpad({ api, projectOf, nameOf = (p) => p, findThread = () => null, go, announce, notify, notice, unnotice, onChange }) {
  const P = new Map();
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}") || {}; } catch { /* private mode */ }
  // want: where focus goes when a redraw takes away the control that had it. Every action and stream event that
  // can do that names its place (Cancel → Change, Undo → Deploy, Stop's window → Stop …); there is no general
  // fallback. A redraw that finds neither the same control nor a named place leaves focus where the browser puts
  // it and records the path in lost (lostFocus(); the browser tests fail on any), so a missing place is a bug
  // that shows, never one that's quietly covered.
  const S = { el: null, hs: null, ha: null, body: null, key: "", html: "", v: null, shown: null, want: "", lost: [] };
  /** Name where focus goes next, if a redraw takes the focused control away. */
  const land = (sel) => { S.want = sel; };
  /** A subject's one notice (a stop's, an unlink's): shown, or changed in place where it already is; unsay takes it
   *  away. Without notice() (an older host), a plain line. */
  const say = (mid, line, ms) => { if (notice) notice(mid, line, ms); else if (notify) notify(line.text, line.undo || null, line.kind); };
  const unsay = (mid) => { if (mid && unnotice) unnotice(mid); };
  /** A stop that won't be asked for, or whose answer no longer matters (the run went live, failed, or was replaced):
   *  its window ends and its notice goes, so nothing on screen offers to stop a run that is over. */
  const endStop = (run) => { if (!run) return; if (run.stopping) { clearTimeout(run.stopping); run.stopping = 0; } unsay(run.mid); };

  const proj = (p) => {
    if (!P.has(p)) P.set(p, { check: null, at: 0, pre: 0, loading: false, err: null, run: null, form: null, device: null, picking: null, asked: null, asking: false, askErr: null, needs: null, warn: null, menu: false, copied: 0, cmdCopied: 0 });
    return P.get(p);
  };
  const changed = () => { onChange && onChange(); };

  // ── what Space says about the project ──────────────────────────────────────
  /** A read that will write the project's check takes a ticket; its answer applies only if no later read's answer
   *  has applied already, so an older answer never overwrites a newer one (Astra: two rechecks, the older won). */
  const ticket = (s) => (s.seq = (s.seq || 0) + 1);
  const current = (s, n) => { if (n <= (s.applied || 0)) return false; s.applied = n; return true; };
  /** A later read's answer has already applied: this one's outcome, success or refusal, changes nothing. */
  const stale = (s, n) => n <= (s.applied || 0);
  /** A recheck asked for (loud) says what the project's current check says about GitHub: the read that answers
   *  last may be a newer one than the recheck's own, and that newer one asked GitHub too (load does, once asked). */
  const sayGitHub = (s) => { s.loud = false; s.ghErr = null; announce(s.check.github?.workflow ? "GitHub has the workflow permission now." : "GitHub still doesn't have the workflow permission."); };
  async function load(p, force = false) {
    const s = proj(p);
    if (s.loading || (!force && s.at && Date.now() - s.at < (s.err ? ERR_MS : AGAIN_MS))) return;
    s.loading = true; s.err = null;
    const n = ticket(s);
    try {
      // once preflight has answered, a refresh asks it again on the fresh check: check alone would put its guesses
      // (origin usable, GitHub able, the app Live) back over what GitHub and Launchpad said
      // (also while a preflight is out: this read's answer then never carries guesses over what that one asks)
      let c = await api.check(p);
      if (s.pre && api.preflight) c = await api.preflight(p, s.form?.name);
      if (!current(s, n)) { s.loading = false; return; } // a newer answer is already here
      s.check = c; s.at = Date.now(); s.err = null;
      if (!s.form) s.form = { name: slug(c.name || p), port: c.port ? String(c.port) : "", repo: c.repo?.create || slug(p), env: {}, errs: {}, size: c.size || "", disk: !!c.storage, diskPath: c.storage?.path || "", diskGb: String(c.storage?.gb || 2) };
      if (c.running && !s.run && c.running !== s.ended) watch(p); // never the run Space just said was over
      cached[p] = c.state;
      try { localStorage.setItem(CACHE, JSON.stringify(cached)); } catch { /* private mode */ }
    } catch (e) {
      // refused, but a newer read has answered since: that answer stands (an old refusal never flips a working
      // screen to Couldn't check)
      if (stale(s, n)) { s.loading = false; changed(); return; }
      s.err = e; s.at = Date.now();
    }
    s.loading = false;
    changed();
  }

  /** Where focus goes when a run is over (stopped, ended): the screen's way on, whichever screen that is. */
  const AFTER = '[data-lp="deploy"], [data-lp="again"], [data-lp="reconnect"], [data-lp="ask"], [data-lp="recheck"]';
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
  /** Space's network answers. One at a time: while one is out (s.pre 1) another isn't sent; a recheck asked for
   *  meanwhile joins it (s.loud), and the one answer says how it went. */
  async function preflight(p) {
    const s = proj(p);
    if (!api.preflight || s.pre || !s.check || s.check.state === "not-deployable" || s.check.state === "needs-agent") return;
    s.pre = 1;
    const n = ticket(s);
    try {
      const c = await api.preflight(p, s.form?.name);
      s.pre = 2;
      if (current(s, n) && c) { s.check = c; s.err = null; }
      // asked for (I ran it: check again): what GitHub says now, in words
      if (s.loud) sayGitHub(s);
    } catch (e) {
      s.pre = 2; // a deploy still says what's wrong, step by step
      // refused, but a newer read has answered since: the recheck's question has that answer, never this refusal
      if (stale(s, n)) { if (s.loud) sayGitHub(s); }
      // asked for: its failure is said, under the button that asked, and in the live region
      else if (s.loud) { s.loud = false; s.ghErr = e?.message || "XO Space didn't answer"; announce(`Couldn't check GitHub: ${s.ghErr}.`); }
    }
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
    if (e.type === "replaced") { endStop(s.run); s.run.stop?.stop(); watch(p); land('[data-lp="stop"]'); changed(); return; } // a deploy started elsewhere: follow it
    if (e.type === "lost") { // the stream couldn't be picked up again: what was moving stops moving, and it's said
      s.run.lost = true;
      for (const st of Object.values(s.run.steps)) if (st.state === "doing") st.state = "paused";
      land('[data-lp="rewatch"]'); changed(); return;
    }
    if (e.type === "ended") { endStop(s.run); s.ended = e.run; s.run = null; s.pre = 0; land(AFTER); load(p, true); changed(); return; } // the run is over: show where it left things
    if (e.type === "needs") {
      s.run = null;
      if (e.code === "name_taken") f.errs = { name: "Taken on Launchpad.", nameFix: e.data.suggestion };
      else if (e.code === "port_missing") f.errs = { port: "Which port does it listen on?" };
      else if (e.code === "repo_name_taken") { f.repo = e.data.suggestion || f.repo; f.repoChosen = true; f.errs = { repo: "That name holds other code on your GitHub." }; }
      else if (e.code === "create_repo") s.check = { ...s.check, repo: { ...s.check.repo, admin: false, why: e.data.reason || s.check.repo.why } };
      else { if (e.code === "confirm_repo") f.useRepo = ""; s.needs = e; } // confirm_repo, link_existing, app_missing: a decision, lit, above the form (a confirmed repo Space asks again about is no longer confirmed)
      land(f.errs.name ? '[data-lp-f="name"]' : f.errs.port ? '[data-lp-f="port"]' : f.errs.repo ? '[data-lp-f="repo"]' : '.lp-ask .lp-go, [data-lp="deploy"], [data-lp="reconnect"]');
      S.key = ""; changed();
      if (f.errs.name || f.errs.port) requestAnimationFrame(() => S.body?.querySelector(`[data-lp-f="${f.errs.name ? "name" : "port"}"]`)?.focus());
      return;
    }
    if (e.state === "doing" || e.state === "done" || e.state === "failed") f.env = {}; // under way: the values have gone with the request
    // the stop we asked for, confirmed by the run itself
    if (e.state === "failed" && e.error?.code === "cancelled" && (s.run.stopSent || s.run.stopErr)) { stopped(p, s.run); return; }
    if (e.state === "failed" && e.error?.code === "size_not_allowed") {
      s.run = null; f.errs = { size: "Launchpad doesn't allow this size for this app. Pick another." }; S.key = ""; land('[data-lp-f="size"]');
      announce("Launchpad doesn't allow that size for this app. Pick another."); changed();
      requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="size"]')?.focus());
      return;
    }
    take(p, e);
    // the run ended on its own (live, or failed) while a stop was in its window or on its way: that stop's notice goes
    if ((e.step === "live" && e.state === "done") || e.state === "failed") endStop(s.run);
    // the run's end moves focus off Stop and Hide: to Deploy again when it went live, to the fix when it failed
    if (e.step === "live" && e.state === "done") land('[data-lp="again"]');
    if (e.state === "failed") land('.lp-rec .lp-go, .lp-acts .lp-go, [data-lp="retry"], [data-lp="recheck-gh"]');
    const name = f.name || nameOf(p);
    if (e.step === "live" && e.state === "done") { announce(`${name} is live.`); if (!visible(p)) notify && notify(`${name} is live`); }
    if (e.state === "failed") { announce(`${name} didn't deploy: ${failWords(s.run.error)}.`); if (!visible(p)) notify && notify(`${name}: ${failWords(s.run.error).toLowerCase()}`, null, "err"); }
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
      case "getting": { const g = s.check.getting || findThread(p) || s.asked, st = askState(p, g); return st.k === "work" ? { tone: "work", words: "Getting ready", at: g.since } : { tone: "", words: st.k === "done" ? "Ready to merge" : "Thread started" }; }
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
        `<p class="lpm-meta"><span class="lpm-k">Release</span>${release ? `<span>#${release}</span>` : ""}${commit ? `<code>${esc(commit)}</code>` : ""}<span>built${at ? ` ${ago(at)}` : " on GitHub"}</span>${of && inst !== "ready" ? `<span>${ready} of ${of} ready</span>` : ""}</p>`
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
    const env = machine + (hasEnv ? `<p class="lpm-meta lpm-env"><span class="lpm-k">Environment</span><span>${c.env.filter((x) => x.set).length} of ${c.env.length} set</span><button type="button" class="lp-a" data-lp="edit">Change</button></p>` : "");
    return mini + cards + env;
  }

  /** The demo's headline: the state in one word or a few, large, and what it means in a sentence */
  const hero = (word, sentence, tone = "") => `<div class="lpv-hero"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${word}</h3>${sentence ? `<p class="lp-p">${sentence}</p>` : ""}</div>`;
  const span = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  /** A decision's own lit button above the form: not when the form is the answer (settings), nor done outside */
  const lit = (nd) => { const a = nextStep(nd.action, nd.data); return a && a[1] !== "settings" && a[1] !== "retry" && a[1] !== "log" ? a : null; };
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
  const cmdHtml = (cmd, s) => { const on = s && s.cmdCopied > Date.now(); return `<div class="lp-cmd"><code>${esc(cmd)}</code><button type="button" class="lp-ib" data-lp="cmd-copy" data-v="${esc(cmd)}" title="${on ? "Copied" : "Copy the command"}" aria-label="Copy the command">${on ? ICON.check : ICON.copy}</button></div>`; };

  const head = (h, p, tone = "") => `<div class="lp-hd"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${h}</h3>${p ? `<p class="lp-p">${p}</p>` : ""}</div>`;
  const rec = (title, text, act, label, icon = "", s = null) => {
    const asking = s && s.asking && /^ask/.test(act), err = s && !s.asking && s.askErr && /^ask/.test(act) ? s.askErr : "";
    return `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>${title}</b><p>${text}</p></div>` +
      `<button type="button" class="lp-go" data-lp="${act}"${asking ? ' aria-disabled="true"' : ""}>${asking ? '<i class="lp-arc" aria-hidden="true"></i><span>Starting a thread…</span>' : `${icon}<span>${err ? "Try again" : label}</span>`}</button>` +
      (err ? `<p class="lp-err" role="status">Couldn't start the thread: ${esc(err)}.</p>` : "") + `</div>`;
  };

  /** Where launchpad.json sends the code, and where git's origin points: both whole, so the person sees the difference. */
  const repoFacts = (nd) => {
    const d = nd.data || {};
    return `<p>launchpad.json names ${d.repo ? `<code>${esc(d.repo)}</code>` : "a repository"}. ${d.origin ? `This project's git origin is <code>${esc(d.origin)}</code>.` : "This project has no git origin."}</p>`;
  };

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
      askedHtml(p) +
      (nd ? `<div class="lp-rec lp-ask"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}One thing first</span><b>${esc(nd.message || "")}</b>${nd.fix ? `<p>${esc(nd.fix)}</p>` : ""}${nd.code === "confirm_repo" ? repoFacts(nd) : ""}</div>${lit(nd) ? `<button type="button" class="lp-go" data-lp="${lit(nd)[1]}"><span>${esc(lit(nd)[0])}</span></button>` : ""}${nd.code === "confirm_repo" ? `<div class="lp-alt"><button type="button" class="lp-a" data-lp="decline-repo"><span>Not this repository</span></button></div>` : ""}</div>` : "") +
      (c.blockers.length ? `<p class="lp-note t-need">Deploy would stop here: ${esc(c.blockers.join("; "))}.</p>` : "") +
      // what Space warned of before the button is pressed (a repository that isn't the person's own, uncommitted changes, …)
      (c.warnings.length ? c.warnings.map((w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("") : "") +
      (editing ? "" : system(p, "preview")) +
      (c.github.source === "gh" && c.github.connected && !c.github.workflow && ghCmd(c.github.fix) ? `<div class="lp-gh"><p class="lp-note">Or grant it to this machine's gh login, then check again:</p>${cmdHtml(ghCmd(c.github.fix), s)}<div class="lp-alt lp-left"><button type="button" class="lp-a" data-lp="recheck-gh"${s.pre === 1 ? ' aria-disabled="true"' : ""}>${s.pre === 1 ? '<i class="lp-arc" aria-hidden="true"></i><span>Checking GitHub…</span>' : `${ICON.retry}<span>I ran it: check again</span>`}</button></div>${s.ghErr ? `<p class="lp-err lp-gh-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` : "") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src" title="This thread's work goes out once it's merged into ${esc(c.repo.branch || "main")}">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b>, not this thread's branch.</span></p>` : "") +
      `<div class="lp-set">` +
      (editing ? "" : field("name", "Name", f.name, { hint: e.name || "It can't change later.", bad: !!e.name, fix: e.nameFix })) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${esc(where(c.portFrom))}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      machineRows(s, c, f, e, editing) +
      // once a repository name had to be chosen, its field stays while you change it (a fixed error mustn't make it vanish)
      (e.repo || f.repoChosen ? field("repo", "Repository", f.repo, { hint: e.repo || hintFor("repo", p), bad: !!e.repo }) : "") +
      `</div>` +
      (env.length ? `<fieldset class="lp-env"><legend><span>Environment</span>${from ? `<small>from ${esc(from)}</small>` : ""}</legend>` +
        mine.map((x) => `<label class="lp-f lp-ev"><span class="lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><input class="lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(editing && x.set ? "Set · leave to keep" : x.default || "Not set")}" aria-label="${esc(x.name)}"></label>`).join("") +
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
    // the app's one dropdown (<xo-select>, js/dropdown.js), never the browser's own <select> (the owner's decision);
    // its row is a div, not a label, so a click on the word Size doesn't open the list
    return (z ? row("Size", `<span class="lp-v"><xo-select class="lp-xs" data-lp-f="size" aria-label="Size" ${ids("size")}>${z.def ? "" : `<option value=""${at ? "" : " selected"}>Launchpad's default</option>`}` +
        z.tiers.map((t) => `<option value="${esc(t.name)}"${at === t.name ? " selected" : ""}${t.name === z.def ? ' data-desc="Default"' : ""}>${esc(`${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB`)}</option>`).join("") +
        `</xo-select>${hint("size", e.size || sizeHint(c, f))}</span>`, !!e.size) : "") +
      (f.disk
        ? row("Disk", `<span class="lp-v"><span class="lp-pair"><input class="lp-in lp-mono" data-lp-f="diskPath" value="${esc(f.diskPath)}" placeholder="/data" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Where the disk is mounted" ${ids("disk")}><input class="lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u">GB</span><button type="button" class="lp-ib" data-lp="disk-remove" title="No disk" aria-label="No disk">${ICON.close}</button></span>${hint("disk", e.disk || "Grows later, never shrinks.")}</span>`, !!e.disk)
        : row("Disk", `<span class="lp-v is-row"><button type="button" class="lp-a lp-add" data-lp="disk-add">${ICON.plus}<span>Add a disk</span></button>${hint("disk", "Only at creation")}</span>`));
  }
  /** A field's hint while its value is valid (what setupHtml and machineRows show without an error). */
  function hintFor(k, p) {
    const s = proj(p), c = s.check, f = s.form, editing = !!(s.editing && c.app);
    if (k === "name") return "It can't change later.";
    if (k === "port") return c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${where(c.portFrom)}` : "Where the app listens";
    if (k === "size") return sizeHint(c, f);
    if (k === "disk") return editing ? "Grows, never shrinks." : "Grows later, never shrinks.";
    if (k === "repo") return "A new repository on your GitHub.";
    return "";
  }
  const sizeHint = (c, f) => (c.sizes?.def && (f.size || c.sizes.def) === c.sizes.def ? "The default; fixed once created." : "Fixed once it's created.");
  function field(id, label, value, { hint = "", bad = false, mode = "text", short = false, fix = "" } = {}) {
    // every hint and error sits under its field, whole (a short field's hint beside it was cut: "A port from 1 to 6553…");
    // Launchpad's free name is a button of its own under the hint, on its edge
    return `<label class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span><span class="lp-v"><input class="lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><span class="lp-hint" id="lp-h-${id}">${hint}</span>${fix ? `<button type="button" class="lp-b lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span></label>`;
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
    // Stop's 3 s: the stop can still be taken back, here where it was asked for (the notice's Undo does the same);
    // then it's out, and only Space's receipt says it stopped (G6)
    const q = r.stopErr ? `<p class="lp-q t-need" role="status">Couldn't stop it: ${esc(r.stopErr)}. It's still deploying.</p>`
      : r.stopSent ? `<p class="lp-q" role="status">Stopping… it stops once Space confirms.</p>`
      : r.stopping ? `<p class="lp-q" role="status">Stops in <span class="lp-count" data-until="${r.stopAt}">${Math.max(1, Math.ceil((r.stopAt - Date.now()) / 1000))}</span> s.</p>`
      : `<p class="lp-q">Carries on if you close this.</p>`;
    const stop = r.stopSent ? `<button type="button" class="lp-b" data-lp="stop" aria-disabled="true"><i class="lp-arc" aria-hidden="true"></i><span>Stopping…</span></button>`
      : r.stopping ? `<button type="button" class="lp-b" data-lp="stop-undo"><span>Keep deploying</span></button>`
      : `<button type="button" class="lp-b" data-lp="stop">${ICON.stop}<span>${r.stopErr ? "Stop again" : "Stop"}</span></button>`;
    return hero(word, sentence, "work") + system(p, "run") + warnHtml(s) +
      `<div class="lp-acts">${q}${stop}<button type="button" class="lp-b" data-lp="hide"><span>Hide</span></button></div>`;
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
    return hero(tone === "go" ? "Live" : words, sentence, tone) + askedHtml(p) +
      system(p, "live") + (s.run?.live ? warnHtml(s) : "") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="again">${LP_ICON.rocket}<span>Deploy again</span></button>${appUrl ? `<a class="lp-b" href="${esc(appUrl)}" target="_blank" rel="noopener"><span>Open in Launchpad</span>${LP_ICON.out}</a>` : ""}` +
      `<span class="lp-mw"><button type="button" class="lp-ib" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" aria-controls="lp-mn" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-mn" id="lp-mn" role="menu" aria-label="More"><button type="button" role="menuitem" tabindex="-1" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span></div>`;
  }

  function failedHtml(p) {
    const s = proj(p), e = s.run.error, name = esc(s.form.name || nameOf(p));
    if (e.code === "build_failed") return hero("The build failed", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", "stop") +
      system(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", LP_ICON.rocket, s) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button>${e.url ? `<a class="lp-b" href="${esc(e.url)}" target="_blank" rel="noopener"><span>Logs on GitHub</span>${LP_ICON.out}</a>` : ""}</div>`;
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return hero(`${e.release ? `Release #${e.release}` : name} didn't go live`, `Nothing answers on port ${e.port}: the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "stop") +
      system(p, "run") +
      rec(`Use port ${e.declared}`, `The image listens on ${e.declared}; the app sends traffic to ${e.port}.`, "fix-port", `Use port ${e.declared}`) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button></div>`;
    if (NEEDS_YOU.has(e.code)) return hero(e.code === "github_workflow_scope" ? "GitHub needs one more permission" : "GitHub isn't connected", e.code === "github_workflow_scope" ? "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes." : esc(e.message || ""), "need") +
      system(p, "run") + (e.source === "gh" && ghCmd(e.fix)
        ? `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>Grant it to this machine's gh login</b><p>Run this, then check again.</p></div>${cmdHtml(ghCmd(e.fix), s)}<button type="button" class="lp-go" data-lp="recheck-gh">${ICON.retry}<span>I ran it: check again</span></button>${s.ghErr ? `<p class="lp-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` +
          `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="reconnect">${LP_ICON.github}<span>Reconnect GitHub here</span></button></div>`
        : rec("Reconnect GitHub", "Grant it once; then deploy again.", "reconnect", e.code === "github_workflow_scope" ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github));
    return hero(`${name} didn't deploy`, esc(e.message || e.text || "Something went wrong on the way."), "stop") + system(p, "run") +
      fixOf(e) + actionHtml(e);
  }

  /** What the app reports about the thread an Ask started: that exact thread (by id), else nothing known. Working
   *  (and its arc, and its clock) only when its agent is at work; never a guess (Astra: idle or unreported threads
   *  were drawn Working). */
  function askState(p, g) {
    const t = g && g.thread ? findThread(p, g.thread) : null, mine = t && t.thread === g.thread ? t : null;
    if (!mine) return { k: "unknown", word: "Started · its status isn't reported yet" };
    if (mine.done) return { k: "done", word: "Done: merge its work, then deploy" };
    if (mine.busy) return { k: "work", word: "Working" };
    return { k: "idle", word: "Not working right now" };
  }
  const askRow = (g, st) => `<ul class="lp-ag"><li><button type="button" class="lp-agr" data-lp="thread" data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${st.k === "work" ? '<i class="arc"></i>' : ""}</span><span class="lp-c"><b>${esc(g.title)}</b><span>${esc(st.word)}</span></span><span class="lp-m">${st.k === "work" ? `<span class="lp-tm">${since(g.since)}</span>` : ""}</span></button></li></ul>`;
  /** The thread an Ask (from a failed deploy) started: its row, with what it means for deploying. */
  function askedHtml(p) {
    const s = proj(p), g = s.asked;
    if (!g || s.check?.state === "needs-agent") return "";
    const st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Merge its work, then deploy again here." : st.k === "work" ? "An agent is fixing it. Deploy again here once its work is merged." : "A thread was started to fix it. Deploy again here once its work is merged.";
    return `<div class="lp-asked"><p class="lp-note">${line}</p>${askRow(g, st)}</div>`;
  }

  function needsHtml(p) {
    const c = proj(p).check;
    return head(`${esc(nameOf(p))} needs preparing first`, "Launchpad can't tell how to run it as it is. An agent can prepare it.") +
      (c.missing.length ? `<ul class="lp-check">${c.missing.map((m) => `<li class="${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lp-c"><b>${esc(cap(m.what))}</b>${m.why ? `<span>${esc(m.why)}</span>` : ""}</span></li>`).join("")}</ul>` : "") +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", LP_ICON.rocket, proj(p));
  }

  function gettingHtml(p) {
    const s = proj(p), g = s.check.getting || findThread(p) || s.asked, st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Once its work is merged, Deploy is ready here." : st.k === "work" ? "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here." : "A thread was started to add what Launchpad needs. Once its work is merged, Deploy is ready here.";
    return head(`Getting ${esc(nameOf(p))} ready`, line) + askRow(g, st) +
      system(p, "preview");
  }

  function deviceHtml(p) {
    const d = proj(p).device;
    if (!d.code) return head("Connecting GitHub…", "A GitHub login this machine already has is used as it is.", "need") + `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Asking Space.</span></p>`;
    return head("Connect GitHub", "Enter this code on GitHub. It grants the <code>workflow</code> permission Launchpad needs.", "need") +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code><button type="button" class="lp-b" data-lp="code-copy">${d.copiedUntil > Date.now() ? ICON.check : ICON.copy}<span>${d.copiedUntil > Date.now() ? "Copied" : "Copy"}</span></button></div>` +
      `<a class="lp-go lp-wide" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a>` +
      `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Waiting for GitHub. This carries on by itself.</span></p>` +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="device-cancel"><span>Cancel</span></button></div>`;
  }

  function pickHtml(p) {
    const s = proj(p), list = s.picking?.apps;
    const wait = (w) => `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    return head("Link an app on Launchpad", `${esc(nameOf(p))} deploys to the app you pick from now on.`) +
      (s.linking ? wait("Linking…") : !list ? wait("Reading your apps…") : !list.length ? `<p class="lp-note">No apps on Launchpad yet.</p>` :
        `<ul class="lp-apps">${list.map((a) => `<li><button type="button" class="lp-appr" data-lp="link" data-id="${esc(a.id)}"${a.linkable ? "" : ` disabled title="Not built from GitHub, so XO can't deploy to it"`}><span class="lp-t">${LP_ICON.app}</span><span class="lp-c"><b>${esc(a.name)}</b>${a.linkable ? `<span class="lp-mono">${esc(a.host)}</span>` : "<span>Not built from GitHub: XO can't deploy to it</span>"}</span><span class="lp-m">${((t, w) => `<span class="lp-st t-${t}">${t === "work" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}${esc(w)}</span>`)(...appState(a.status))}</span></button></li>`).join("")}</ul>`) +
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
      key: `${p}|${sc}` + (sc === "setup" ? `|${formKey(c, { pre: s.pre, needs: s.needs && [s.needs.code, s.needs.message, s.needs.fix, s.needs.action, s.needs.data?.repo, s.needs.data?.origin], errs: s.form.errs || {}, envAll: !!s.envAll, editing: !!s.editing, machine: !!s.machine, disk: !!s.form.disk, thread: !!S.v?.startsWith("t:"), ghErr: s.ghErr || "", asked: !!s.asked })}` : ""),
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
      const ae = document.activeElement && S.body.contains(document.activeElement) ? (document.activeElement.closest("xo-select") || document.activeElement) : null;
      // the focused control by what it is, and which of its kind (Copy shows twice: the panel's line, the wide card)
      const [focus, nth] = ae && ae !== S.body ? keyOf(ae) : [null, 0];
      const caret = ae && ae.matches("input") ? [ae.selectionStart, ae.selectionEnd] : null;
      const fresh = S.key.split("|").slice(0, 2).join("|") !== b.key.split("|").slice(0, 2).join("|");
      S.body.innerHTML = `<div class="lp${fresh ? " is-new" : ""}" data-screen="${b.key.split("|")[1]}">${b.html}</div>`;
      // typed environment values go back into their inputs as properties, never into the markup (no value
      // attribute, nothing in outerHTML), so a redraw leaves no copy of a secret behind (Astra on 4026444)
      if (b.form) { const env = proj(p).form?.env || {}; for (const n of S.body.querySelectorAll("[data-lp-env]")) if (env[n.dataset.lpEnv]) n.value = env[n.dataset.lpEnv]; }
      // a dropdown's combobox is its inner button: it carries the field's hint and its invalid state
      for (const x of S.body.querySelectorAll("xo-select[data-lp-f]")) { const btn = x.querySelector(".dd-btn"); if (!btn) continue; for (const a of ["aria-describedby", "aria-invalid"]) if (x.hasAttribute(a)) btn.setAttribute(a, x.getAttribute(a)); }
      if (fresh) S.body.scrollTop = 0;
      S.key = b.key; S.html = same;
      requestAnimationFrame(over);
      // focus that was in the section stays in it: on the same control, else on the place the action named. A
      // named place not drawn yet (Checking…, Connecting…) holds focus on the section until it is
      const named = () => { const m = S.want && S.body.querySelector(S.want); if (m) S.want = ""; return m; };
      const n = !ae ? null : ae === S.body ? named() : (focus && (S.body.querySelectorAll(focus)[nth] || S.body.querySelector(focus))) || named();
      if (!ae) S.want = "";
      if (n) { n.focus({ preventScroll: true }); if (caret && n.setSelectionRange) try { n.setSelectionRange(...caret); } catch { /* a number field */ } }
      else if (ae && ae !== S.body) {
        if (S.want) S.body.focus({ preventScroll: true });
        else S.lost.push(`${b.key.split("|")[1]}: ${focus || ae.tagName.toLowerCase()}`); // no place named: a bug, and tests say so
      }
    }
  }
  /** A control's key across a redraw: its field, its action (data-lp), or a link's address; and its place among its kind. */
  function keyOf(el) {
    const sel = el.dataset.lpF ? `[data-lp-f="${el.dataset.lpF}"]` : el.dataset.lpEnv ? `[data-lp-env="${CSS.escape(el.dataset.lpEnv)}"]`
      : el.dataset.lp ? `[data-lp="${el.dataset.lp}"]` : el.matches("a[href]") ? `a[href="${CSS.escape(el.getAttribute("href"))}"]` : null;
    return sel ? [sel, Math.max(0, [...S.body.querySelectorAll(sel)].indexOf(el))] : [null, 0];
  }
  /** As you type: the card's name, address and port follow the fields, and nothing else redraws. */
  function syncPreview(p) {
    const f = proj(p).form, view = S.body.querySelector('.lpv[data-mode="preview"]');
    const sh = S.body.querySelector("#lp-h-size");
    if (sh && !f.errs?.size && sh.closest(".lp-f")?.querySelector("xo-select")) sh.textContent = sizeHint(proj(p).check, f);
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
      S.key = ""; land('[aria-invalid="true"], .is-bad input, .is-bad xo-select'); changed();
      requestAnimationFrame(() => S.body?.querySelector('[aria-invalid="true"], .is-bad input, .is-bad xo-select')?.focus());
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
    land('[data-lp="undo"]'); changed();
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
    s.sent = { again, recreate: !!f.recreate, edit: !!s.run.edit }; // what a decision's answer deploys again with
    const body = { name: f.name, port: Number(f.port), ...machine, ...(f.useRepo ? { use_repo: f.useRepo } : {}), ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.repoChosen ? f.repo : f.name }), ...(c.app && again && !f.recreate && (s.run.edit || !c.behind) ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((x) => x.sensitive).map((x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now(); s.run.sent = Object.keys(env); // names only: what goes live with this release
    s.needs = null; s.warn = null; f.recreate = false; // recreate is asked once, not for every deploy after
    s.run.stop = api.deploy(p, body, (e) => event(p, e));
    if (S.shown !== p) f.env = {}; // sent with the section put away: nothing here to keep them for
    land('[data-lp="stop"]'); // Undo's time is up: it goes, Stop takes its place
    changed();
  }
  const visible = (p) => S.el && !S.el.classList.contains("is-folded") && !S.el.hidden && S.v && projectOf(S.v) === p && document.body.classList.contains("stage-open");

  /** Reconnect GitHub with the workflow scope: Space's device flow, polled until it's granted. */
  async function github(p) {
    const s = proj(p);
    // this call owns one code: Cancel, or a newer Reconnect, makes it someone else's, and from then on this call's
    // answers (a late start, a poll that fails or succeeds) change nothing (Astra: an old poll cleared a newer code)
    let cur = s.device = { code: "", url: "", copiedUntil: 0 };
    const ours = () => s.device === cur;
    land('[data-lp="code-copy"], [data-lp="device-cancel"]'); // Connecting… has nothing to press: the section holds focus till the code comes
    changed();
    try {
      const gh = s.check.github;
      const d = await api.githubStart(gh.connected && gh.source === "connections");
      if (!ours()) return; // cancelled or started again meanwhile
      if (d.connected) { s.device = null; s.pre = 0; land(AFTER + ', [data-lp="retry"]'); if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null; announce(`GitHub is connected${d.username ? ` as ${d.username}` : ""}${d.imported ? ", from this machine's gh login" : ""}.`); changed(); preflight(p); return; }
      cur = s.device = { ...d, copiedUntil: 0 };
      changed();
      while (ours() && (!d.until || Date.now() < d.until)) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!ours()) return;
        const r = await api.githubPoll(d.id);
        if (!ours()) return; // its answer came after a Cancel or a new code: not this screen's any more
        if (r?.failed) throw new Error(r.failed);
        if (r?.done) {
          s.device = null; s.pre = 0; land(AFTER + ', [data-lp="retry"]');
          if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null;
          announce("GitHub is connected.");
          changed(); preflight(p);
          return;
        }
      }
      if (ours()) { s.device = null; land('[data-lp="reconnect"]'); notify && notify("GitHub's code ran out. Reconnect again.", null, "err"); changed(); }
    } catch (e) { if (!ours()) return; s.device = null; land('[data-lp="reconnect"]'); notify && notify(`GitHub didn't connect: ${e.message}`, null, "err"); changed(); }
  }

  async function startPick(p) {
    const s = proj(p);
    s.picking = { apps: null };
    land('[data-lp="pick-cancel"]'); // Back, while it reads; the list arrives under it
    changed();
    try { const apps = await api.apps(p); if (s.picking) s.picking.apps = apps; } // Back meanwhile: nothing to fill
    catch (e) { s.picking = null; land('[data-lp="pick"]'); notify && notify(`Couldn't read your Launchpad apps: ${e.message}`, null, "err"); }
    changed();
  }

  /** Link an app on Launchpad, then read the project afresh: lpapi's preflight builds on the last check, which
   *  doesn't know the link yet, and link answers before Launchpad has a status. */
  function link(p, id) {
    const s = proj(p);
    s.picking = null; s.linking = true; land('[data-lp="pick-cancel"]'); changed();
    api.link(p, id)
      .then((a) => { s.check = { ...s.check, state: "linked", app: a }; s.run = null; land('[data-lp="again"]'); load(p, true); })
      .catch((e) => { land('[data-lp="pick"]'); notify && notify(`Couldn't link it: ${e.message}`, null, "err"); })
      .finally(() => { s.linking = false; changed(); });
  }

  /**
   * Ask Space to stop the run, and say it stopped only once Space says so: DELETE answers {stopped: true} once the
   * deploy has ended (or the stream's own `error cancelled` comes first). Refused (offline, an error), the run is
   * still followed, the card says it couldn't stop, and Stop is there again. Nothing to stop: it had already ended,
   * and the stream's last event says how.
   */
  // the run reached its end on the stream (live, failed, or stopped): that is what it did, whatever a stop
  // request answers later
  const runOver = (run) => !!(run.live || run.error || run.ended);
  function stopNow(p, run) {
    const s = proj(p);
    if (s.run !== run || runOver(run)) { unsay(run.mid); return; }
    if (!api.stop) return;
    run.stopSent = true; run.stopErr = null; changed();
    const name = s.form?.name || nameOf(p);
    // the window has ended and the stop is on its way: the same notice says so, with no Undo (it's no longer one)
    say(run.mid, { text: `Stopping the deploy of ${name}…`, sub: "Waiting for Space to confirm", kind: "halt" }, 30000);
    // only an explicit receipt says it stopped: {stopped: true}, or the stream's own `error cancelled`
    const refused = (why) => {
      run.stopErr = why;
      announce(`Couldn't stop the deploy: ${why}. It's still running.`);
      // refused: the same notice says so, with Stop again (it works from there, whatever is on screen)
      say(run.mid, { text: `Couldn't stop the deploy of ${name}`, sub: `${why}. It's still deploying.`, kind: "err",
        undo: () => { fromNotice(p, '[data-lp="stop"]'); startStop(p); }, undoLabel: "Stop again" }, 6000);
      changed();
    };
    // the answer lands after the run ended: what ended it has its say. The stream's cancelled said the outcome in this
    // notice (run.ended: stopped()), and a late answer, receipt or refusal, leaves it; any other end, the waiting goes
    const late = () => { if (!run.ended) unsay(run.mid); changed(); };
    api.stop(p).then((r) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      if (r && r.stopped === true) { stopped(p, run); return; }
      if (r && r.stopped === false) { announce("Nothing was running to stop: the stream says how it ended."); say(run.mid, { text: "Nothing was running to stop", kind: "done" }, 4200); changed(); return; }
      refused("Space didn't confirm it");
    }, (e) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      refused((e && e.message) || "Space didn't answer");
    });
  }
  /** The stop taken back within its 3 s: nothing was sent; Stop is there again, focused where Keep deploying was. */
  function keep(p, run) {
    if (!run.stopping) return;
    clearTimeout(run.stopping); run.stopping = 0;
    unsay(run.mid); // taken back here (Keep deploying) or in the notice: the notice goes either way
    land('[data-lp="stop"]'); // Keep deploying goes; focus that was on it goes back to Stop
    announce("The deploy carries on.");
    changed();
  }
  /** Stop, for project p's run (from its section, or from its notice's Stop again wherever you are): Undo for 3 s
   *  (Keep deploying, here, or the notice's Undo, whose deadline is this window's), then the stop is asked for; the
   *  run stays followed until Space confirms it. One notice for this run's stop (mid), changed in place throughout. */
  function startStop(p) {
    const s = proj(p), run = s.run;
    if (!run || run.stopping || run.stopSent || runOver(run)) return;
    run.stopErr = null;
    run.mid = `lp-stop:${p}:${run.startedAt}`;
    run.stopAt = Date.now() + STOP_MS;
    // the window ends: Keep deploying goes, and focus that was on it moves to Stop (Stopping…, then Stop again)
    run.stopping = setTimeout(() => { run.stopping = 0; land('[data-lp="stop"]'); stopNow(p, run); }, STOP_MS);
    const tick = setInterval(() => {
      if (!run.stopping) { clearInterval(tick); return; }
      const n = S.body?.querySelector('.lp-q .lp-count');
      if (n) n.textContent = String(Math.max(1, Math.ceil((run.stopAt - Date.now()) / 1000)));
    }, 200);
    // the notice lives a moment past its window; the window's end changes it in place before then
    say(run.mid, { text: `Stopping the deploy of ${s.form?.name || nameOf(p)}`, kind: "halt", until: run.stopAt,
      undo: () => { fromNotice(p, '[data-lp="stop-undo"]'); keep(p, run); } }, STOP_MS + 1000);
    land('[data-lp="stop-undo"]'); changed();
    announce(`Stopping the deploy in 3 seconds. Keep deploying to take it back.`);
  }
  /** The stop is confirmed: the run is over; the project as it now is. */
  function stopped(p, run) {
    const s = proj(p);
    if (s.run !== run) return;
    run.ended = true;
    run.stop && run.stop.stop();
    s.run = null; s.pre = 0; land(AFTER);
    announce("Deploy stopped.");
    say(run.mid, { text: `Deploy of ${s.form?.name || nameOf(p)} stopped`, kind: "done" }, 4200); // the same notice, its outcome
    load(p, true); changed();
  }

  /** A notice's Undo was pressed for project p: focus moves before the notice takes its button away, onto what the
   *  Undo brought back, and only onto a control a person can reach. In order:
   *    1. p's section, open: sel in it (the redraw then names the final place);
   *    2. p's section in the open panel, folded: its head's fold (the run Undo kept is in there);
   *    3. p on screen with the panel closed: the header's Deploy for p;
   *    4. another place on screen: that page's work (the notice isn't about it: never another project's Deploy);
   *    5. on a phone the open panel covers the page: the panel's own way back to it (Close the panel).
   *  A control under the covering panel (a phone) is out of reach even where it isn't inert. */
  function fromNotice(p, sel) {
    const covered = document.body.classList.contains("stage-open") && matchMedia("(max-width: 760px)").matches;
    const reach = (el) => !!(el && el.getClientRects().length && !el.closest("[inert]") && !(covered && !el.closest("#stage")));
    const go = (el) => { el.focus({ preventScroll: true }); return true; };
    const n = visible(p) && S.body.querySelector(sel);
    if (reach(n)) return go(n);
    const fold = S.el && !S.el.hidden && projectOf(S.v) === p && document.body.classList.contains("stage-open") && S.el.querySelector('[data-fr-fold="launch"]');
    if (reach(fold)) return go(fold);
    const d = projectOf(S.v) === p && [...document.querySelectorAll("[data-lp-open]")].find(reach);
    if (d) return go(d);
    const w = ["scroller", "home"].map((id) => document.getElementById(id)).find(reach);
    if (w) return go(w);
    const close = document.querySelector("#stage [data-stg-close]");
    if (reach(close)) return go(close);
    return false;
  }

  /** The ⋯ menu: opens with focus on its first item; closes back onto More (when focus was in it). */
  function menu(p, open, focusIn = false) {
    const s = proj(p);
    if (s.menu === open) return;
    const inside = !open && !!S.body?.querySelector(".lp-mn")?.contains(document.activeElement);
    if (inside) land('[data-lp="menu"]'); // its item goes with it: focus back on More
    s.menu = open; changed();
    if (open && focusIn) requestAnimationFrame(() => S.body?.querySelector('.lp-mn [role="menuitem"]')?.focus({ preventScroll: true }));
  }

  /** A copy that says "Copied" only once the text is on the clipboard (util.copyText), and only for 1.5 s from that
   *  copy (each button's receipt is a time, never a lasting flag). Refused, it says why, focus stays on the button,
   *  and unmark() takes back what an earlier success still shows: a refusal never wears the last copy's "Copied". */
  async function copied(text, what, mark, unmark) {
    const ok = await copyText(String(text || ""));
    if (!ok) { unmark && unmark(); changed(); announce(COPY_REFUSED); notify && notify(COPY_REFUSED, null, "err"); return; }
    mark(); announce(`Copied ${what}.`); changed();
    clearTimeout(S.copiedT); S.copiedT = setTimeout(changed, 1600); // the latest Copy's 1.5 s, not the first's
  }

  function act(name, el) {
    const p = projectOf(S.v);
    if (!p) return;
    const s = proj(p);
    switch (name) {
      case "open": onOpen && onOpen(); return;
      case "deploy": deploy(p); return;
      case "undo": if (s.run) { s.run = null; land('[data-lp="deploy"], [data-lp="again"], [data-lp="recreate"]'); announce("Deploy undone. Nothing changed."); changed(); } return;
      case "hide": { const here = S.body?.contains(document.activeElement); onHide && onHide(); if (here) S.el.querySelector('[data-fr-fold="launch"]')?.focus({ preventScroll: true }); return; } // folded: focus on its head's fold
      case "stop": startStop(p); return;
      case "stop-undo": if (s.run) keep(p, s.run); return;
      case "cmd-copy": copied(el.dataset.v, "the command", () => {
        s.cmdCopied = Date.now() + 1500;
        // the setup form isn't redrawn under the person's fingers: its button shows the check itself
        if (el.isConnected) { el.innerHTML = ICON.check; el.title = "Copied"; clearTimeout(el._copied); el._copied = setTimeout(() => { if (el.isConnected) { el.innerHTML = ICON.copy; el.title = "Copy the command"; } }, 1500); }
      }, () => { s.cmdCopied = 0; clearTimeout(el._copied); if (el.isConnected) { el.innerHTML = ICON.copy; el.title = "Copy the command"; } }); return;
      case "recheck-gh": {
        // one check at a time: pressed again while one is out, it joins that one (which then says how it went)
        s.loud = true; s.ghErr = null;
        if (s.pre === 1) return;
        land('[data-lp="recheck-gh"], [data-lp="deploy"], [data-lp="reconnect"]'); s.pre = 0; if (NEEDS_YOU.has(s.run?.error?.code)) s.run = null;
        announce("Checking GitHub again."); changed(); preflight(p); return;
      }
      case "rewatch": s.run = null; watch(p); land('[data-lp="stop"]'); changed(); return;
      case "settings": s.run = null; s.needs = null; S.key = ""; land(s.form.errs?.size ? '[data-lp-f="size"]' : '[data-lp-f="name"]'); changed(); requestAnimationFrame(() => S.body?.querySelector(s.form.errs?.size ? '[data-lp-f="size"]' : '[data-lp-f="name"]')?.focus()); return;
      case "machine-open": s.machine = true; S.key = ""; land('[data-lp-f="size"]'); changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="size"]')?.focus()); return;
      case "disk-add": s.form.disk = true; s.form.errs = { ...s.form.errs, disk: "" }; S.key = ""; land('[data-lp-f="diskPath"]'); changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp-f="diskPath"]')?.focus()); return;
      case "disk-remove": s.form.disk = false; s.form.errs = { ...s.form.errs, disk: "" }; S.key = ""; land('[data-lp="disk-add"]'); changed(); requestAnimationFrame(() => S.body?.querySelector('[data-lp="disk-add"]')?.focus()); return;
      case "use-repo": { // the repository Space asked about, confirmed: the same deploy again, with it named exactly
        const repo = s.needs?.data?.repo, was = s.sent || {};
        if (!repo) return;
        s.form.useRepo = repo; s.form.recreate = !!was.recreate; s.editing = !!(was.edit && s.check?.app);
        s.needs = null; s.run = null; deploy(p, !!was.again); return;
      }
      case "decline-repo": s.needs = null; s.form.useRepo = ""; s.run = null; S.key = ""; land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not deploying to that repository. Nothing changed."); changed(); return;
      case "create-repo": s.check = { ...s.check, repo: { ...s.check.repo, admin: false } }; s.needs = null; s.run = null; deploy(p); return;
      case "link-same": { const id = s.needs?.data?.app?.id || s.run?.error?.app?.id; s.needs = null; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); if (id) api.link(p, id).then((a) => { s.check = { ...s.check, state: "linked", app: a }; deploy(p, true); }).catch((err) => notify && notify(`Couldn't link it: ${err.message}`, null, "err")); changed(); return; }
      case "env-all": { // the first of the names it shows, by name (an index into the list could miss when they interleave)
        const f = s.form, first = (s.check.env || []).find((x) => !(x.sensitive || !x.default || f.env[x.name]));
        s.envAll = true; S.key = ""; land(first ? `[data-lp-env="${CSS.escape(first.name)}"]` : ".lp-ev input"); changed(); return;
      }
      case "recreate": s.form.recreate = true; s.run = null; deploy(p, true); return;
      case "edit": s.editing = true; s.form.diskGb = String(s.check.app?.storage?.gb || ""); s.form.errs = {}; s.menu = false; S.key = ""; land("[data-lp-f], .lp-ev input"); changed(); requestAnimationFrame(() => S.body?.querySelector(".lp-ev input, [data-lp-f]")?.focus()); return;
      case "edit-cancel": s.editing = false; s.form.env = {}; S.key = ""; land('[data-lp="edit"]'); changed(); return;
      case "again": s.run = null; s.form.errs = {}; deploy(p, true); return; // the linked app, the same settings: 3 s, then it goes
      case "retry": s.run = null; deploy(p); return;
      case "copy": copied((s.run?.live || s.check.app).url, "the address", () => { s.copied = Date.now() + 1500; }, () => { s.copied = 0; }); return;
      case "menu": menu(p, !s.menu, !s.menu); return;
      case "unlink": {
        // Undo is real: Space unlinks (and commits launchpad.json) only once its 3 s are up
        s.menu = false; s.needs = null;
        const was = s.check, run = s.run;
        s.check = { ...was, app: null, state: "ready" }; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); changed();
        // one notice for this unlink: its Undo lasts exactly as long as the unlink waits (one clock); when it's sent,
        // the same notice loses its Undo; refused, it says so in place. Refused or undone: the app is back, and focus
        // with it on More, where Unlink was
        const mid = `lp-unlink:${p}`, until = Date.now() + UNLINK_MS;
        const t = setTimeout(() => {
          say(mid, { text: "Unlinked from Launchpad", kind: "done" }, 2400);
          api.unlink(p).then(() => load(p, true)).catch((e) => {
            s.check = was; land('[data-lp="menu"]');
            say(mid, { text: `Couldn't unlink from Launchpad`, sub: `${e.message}. It's still linked.`, kind: "err" }, 6000);
            announce(`Couldn't unlink: ${e.message}. It's still linked.`); changed();
          });
        }, UNLINK_MS);
        say(mid, { text: "Unlinked from Launchpad", kind: "done", until,
          undo: () => { fromNotice(p, '[data-lp="deploy"], [data-lp="reconnect"]'); clearTimeout(t); s.check = was; s.run = run; land('[data-lp="menu"]'); changed(); } }, UNLINK_MS + 1000);
        return;
      }
      case "pick": startPick(p); return;
      case "pick-cancel": s.picking = null; land('[data-lp="pick"]'); changed(); return;
      case "link": link(p, el.dataset.id); return;
      case "reconnect": github(p); return;
      case "code-copy": { const d = s.device; copied(d.code, "the code", () => { if (s.device === d) d.copiedUntil = Date.now() + 1500; }, () => { d.copiedUntil = 0; }); return; }
      case "device-cancel": if (s.device?.id && api.githubCancel) api.githubCancel(s.device.id); s.device = null; land('[data-lp="reconnect"], [data-lp="deploy"]'); changed(); return;
      case "ask": case "ask-fix": {
        if (s.asking) return; // one thread per ask: a second click while Space answers starts nothing
        const e = s.run?.error;
        const note = name === "ask-fix" && e ? `The deploy failed: ${e.message || e.text || e.code}${e.step ? ` (in ${e.step})` : ""}. Fix the cause so it deploys.` : "";
        s.asking = true; s.askErr = null; changed();
        api.askAgent(p, note).then((g) => { s.asking = false; s.asked = { thread: g.thread_ts || g.thread, title: g.title || "Deploy to Launchpad", since: Date.now() }; s.run = null; land('[data-lp="thread"]'); announce("A thread is getting it ready."); changed(); })
          .catch((err) => {
            s.asking = false; s.askErr = err?.message || "XO Space didn't answer";
            announce(`Couldn't start the thread: ${s.askErr}.`); changed();
            requestAnimationFrame(() => S.body?.querySelector(`[data-lp="${name}"]`)?.focus({ preventScroll: true }));
          });
        return;
      }
      // the thread takes the place of what's shown, and focus goes to it: go() places it (on a phone, the panel goes
      // first: app.js go(), S193)
      case "thread": go && go(el.dataset.go); return;
      case "fix-port": s.form.port = String(s.run.error.declared); s.run = null; deploy(p); return;
      case "use-name": s.form.name = el.dataset.v; s.form.errs = {}; S.key = ""; land('[data-lp-f="name"]'); changed(); return;
      case "recheck": s.err = null; land(AFTER); load(p, true); changed(); return; // Checking… has nothing to press: the section holds focus
    }
  }
  let onOpen = null, onHide = null;


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
    pointerFollows(S.body); // the ⋯ menu: the item under the mouse is the active one (C058)
    addEventListener("resize", over);
    onOpen = open; onHide = hide;
    section.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lp]");
      if (!b || !section.contains(b)) { if (!e.target.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) menu(p, false); } return; }
      e.preventDefault();
      act(b.dataset.lp, b);
    });
    section.addEventListener("input", (e) => {
      const p = projectOf(S.v), t = e.target;
      if (!p || !t.matches("input, xo-select")) return;
      const f = proj(p).form;
      if (t.dataset.lpF) f[t.dataset.lpF] = t.dataset.lpF === "name" || t.dataset.lpF === "repo" ? t.value.toLowerCase() : t.value.trim();
      if (t.dataset.lpEnv) f.env[t.dataset.lpEnv] = t.value;
      const k = t.dataset.lpF === "diskPath" || t.dataset.lpF === "diskGb" ? "disk" : t.dataset.lpF;
      if (k && f.errs && f.errs[k]) {
        delete f.errs[k]; if (k === "name") delete f.errs.nameFix;
        const l = t.closest(".lp-f"); l?.classList.remove("is-bad");
        for (const n of l ? l.querySelectorAll("[aria-invalid]") : []) n.removeAttribute("aria-invalid");
        t.removeAttribute("aria-invalid"); t.querySelector?.(".dd-btn")?.removeAttribute("aria-invalid");
        l?.querySelector(".lp-fix")?.remove();
        const h = S.body.querySelector(`#lp-h-${k}`); if (h) h.textContent = hintFor(k, p);
        S.key = bodyHtml(p).key; // the form as it now stands: the next paint has nothing to redraw
      }
      syncPreview(p);
    });
    section.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches?.(".lp-in")) { e.preventDefault(); const go = S.body.querySelector(".lp-foot .lp-go"); if (go) act(go.dataset.lp, go); }
      // the ⋯ menu: Esc closes it onto More; the arrows, Home and End move within it; Tab leaves and closes it
      const p = projectOf(S.v);
      if (p && proj(p).menu && e.target.closest?.(".lp-mw")) {
        const items = [...S.body.querySelectorAll('.lp-mn [role="menuitem"]')];
        if (e.key === "Tab") { menu(p, false); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && items.length) {
          e.preventDefault();
          const i = items.indexOf(document.activeElement);
          const n = e.key === "Home" || i < 0 ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
          items[n].focus({ preventScroll: true });
        }
      }
    });
    // Esc in the ⋯ menu closes the menu, not the panel: heard before the panel's own Esc (stage.js listens in its
    // capture phase), so only from the document's
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !S.body) return;
      const x = e.target.closest?.(".fr-lp xo-select.is-open");
      if (x) { e.preventDefault(); e.stopPropagation(); x.close(true); return; } // the list closes, focus stays on Size
      if (!e.target.closest?.(".fr-lp .lp-mw")) return;
      const p = projectOf(S.v);
      if (!p || !proj(p).menu) return;
      e.preventDefault(); e.stopPropagation();
      S.body.querySelector('[data-lp="menu"]')?.focus({ preventScroll: true });
      menu(p, false);
    }, true);
    // a menu left by focus (a click elsewhere in the page, the window) closes
    section.addEventListener("focusout", (e) => {
      const p = projectOf(S.v);
      if (!p || !proj(p).menu || !e.target.closest?.(".lp-mw")) return;
      setTimeout(() => { const mw = S.body?.querySelector(".lp-mw"); if (proj(p).menu && mw && !mw.contains(document.activeElement)) menu(p, false); }, 0);
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
    /** Read-only, for tests: the screen a view's project shows, and its error words. */
    inspect(v) { const p = projectOf(v); if (!p) return null; const s = proj(p); return { screen: screen(p), err: s.err ? String(s.err.message || s.err) : null, ghErr: s.ghErr || null, workflow: s.check?.github?.workflow ?? null, pre: s.pre }; },
    /** Redraws that took the focused control away with no place named for focus (each one is a bug). */
    lostFocus: () => S.lost.slice(),
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
