// Launchpad: put a project on the web from where you work, drawn into its window (js/lpwindow.js).

import { ICON, ARC } from "./ui.js";
import { xi } from "./icon.js";
import { appState, nextStep, formKey, launchpadUrl, sizeWords } from "./lpapi.js";
import { esc, copyText, COPY_REFUSED } from "./util.js";
import { pointerFollows, focusOpened } from "./keynav.js";
import { redraw } from "./redraw.js";

export const LP_ICON = {
  rocket: ICON.deploy, github: ICON.github, image: ICON.container, app: ICON.server, out: ICON.out, more: ICON.more,
  link: ICON.link, x: ICON.close,
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
  const S = { el: null, hs: null, nav: null, notes: null, body: null, key: "", html: "", v: null, shown: null, want: "", lost: [] };
  /** Name where focus goes next, if a redraw takes the focused control away. */
  const land = (sel) => { S.want = sel; };
  /** A subject's one notice (a stop's, an unlink's): shown, or changed in place where it already is; unsay takes it
   *  away. Without notice() (an older host), a plain line. */
  // while the window is open its notices show in it (the page's line is under the window, out of reach); closed,
  // what's still on goes to the page's line for the time it has left
  const N = new Map();
  let seq = 0;
  const local = () => !!(S.notes && S.shown);
  function drawNotes() {
    if (!S.notes) return;
    const now = Date.now();
    redraw(S.notes, [...N].map(([mid, { line: l }]) => { const undo = l.undo && (!l.until || l.until > now), err = l.kind === "err";
      return `<div class="hr hr-ev${undo ? " has-undo" : ""} k-${err ? "stopped" : "done"}" data-mid="${esc(mid)}"><span class="hr-ic ${err ? "k-stopped" : "k-ok"}">${err ? ICON.close : ICON.check}</span><span class="hr-t">${esc(l.text)}</span>${l.sub ? `<span class="hr-s">${esc(l.sub)}</span>` : ""}${undo ? `<button type="button" class="hr-undo" data-lq-undo>${esc(l.undoLabel || "Undo")}</button>` : ""}</div>`; }).join(""));
  }
  const drop = (mid) => { const n = N.get(mid); if (!n) return false; clearTimeout(n.t); clearTimeout(n.u); N.delete(mid); return true; };
  const say = (mid, line, ms) => {
    if (local()) {
      drop(mid);
      N.set(mid, { line, until: Date.now() + ms, t: setTimeout(() => { N.delete(mid); drawNotes(); }, ms), u: line.until ? setTimeout(drawNotes, Math.max(0, line.until - Date.now())) : 0 });
      drawNotes(); return;
    }
    if (notice) notice(mid, line, ms); else if (notify) notify(line.text, line.undo || null, line.kind);
  };
  const unsay = (mid) => { if (!mid) return; if (drop(mid)) drawNotes(); else if (unnotice) unnotice(mid); };
  const tell = (text, undo = null, kind = "done") => (local() ? say(`lp-n${++seq}`, { text, kind, undo }, kind === "err" ? 6000 : 4200) : notify && notify(text, undo, kind));
  /** The window closed: its notices still on go to the page's line, for the time they have left. */
  function handOver() {
    const now = Date.now();
    for (const [mid, n] of [...N]) { drop(mid); if (n.until > now && notice) notice(mid, n.line, n.until - now); }
    drawNotes();
  }
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
      else { if (e.code === "confirm_repo") f.useRepo = ""; if (e.code === "other_apps") f.allowApps = null; s.needs = e; } // confirm_repo, link_existing, app_missing: a decision, lit, above the form (a confirmed repo Space asks again about is no longer confirmed)
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
    if (e.step === "live" && e.state === "done") { announce(`${name} is live.`); if (!visible(p)) tell(`${name} is live`); }
    if (e.state === "failed") { announce(`${name} didn't deploy: ${failWords(s.run.error)}.`); if (!visible(p)) tell(`${name}: ${failWords(s.run.error).toLowerCase()}`, null, "err"); }
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
        if (a.gone) return { tone: "stop", words: "App not on Launchpad" };
        const [tone, words] = st ? appState(st) : ["go", "Live"]; // no status yet (before preflight): it was live when linked
        return { tone, words, host: a.host, url: a.url };
      }
      default: return { tone: "", words: "" };
    }
  }
  const failWords = (e) => ({ build_failed: "Build failed", build_timeout: "Build is slow", health_check_failed: "Didn't go live", release_failed: "Didn't go live", release_timeout: "Release is slow", github_workflow_scope: "Needs GitHub", github_not_connected: "Needs GitHub", github_token_invalid: "Needs GitHub", push_rejected: "Push refused", remote_ahead: "Push refused", launchpad_unreachable: "Launchpad didn't answer", github_unreachable: "GitHub didn't answer", launchpad_limit: "App limit reached", launchpad_forbidden: "Launchpad said no", cancelled: "Stopped" })[e.code] || "Didn't deploy";

  // ── the window's parts ──────────────────────────────────────────────────────
  const btn = (act, label, icon = "", lit = false, more = "") => `<button type="button" class="btn ${lit ? "btn-pri lp-go" : "lp-b"}" data-lp="${act}"${more}>${icon}<span>${label}</span></button>`;
  const out = (href, label, lit = false) => { const h = esc(href), in_ = `<span>${label}</span>${LP_ICON.out}`; return lit ? `<a class="btn btn-pri lp-go" href="${h}" target="_blank" rel="noopener">${in_}</a>` : `<a class="btn lp-b" href="${h}" target="_blank" rel="noopener">${in_}</a>`; };
  const eye = (tone, words, meta = "") => `<p class="lq-eye${tone ? ` t-${tone}` : ""}"><i aria-hidden="true"></i><span>${words}</span>${meta ? `<em>· ${meta}</em>` : ""}</p>`;
  /** Every screen's top: where it stands, its title, the address, its buttons, and a sentence. */
  const top = ({ tone = "", words = "", meta = "", title, sub = "", addr = "", acts = "" }) =>
    `<header class="lq-top">${words ? eye(tone, words, meta) : ""}<div class="lq-hero"><h2 class="lq-t lp-h" id="lq-title">${title}</h2>${addr}${sub ? `<p class="lq-sub lp-p">${sub}</p>` : ""}${acts ? `<div class="lq-acts lp-acts">${acts}</div>` : ""}</div></header>`;
  /** The address Launchpad gave (never one made up from the name), with Copy. */
  const addrHtml = (s, a, on = true) => (a?.host ? `<p class="lq-addr${on ? "" : " is-off"}"><a class="lq-host" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open ${esc(a.host)}">${esc(a.host)}</a><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button></p>` : "");

  /** The deploy's four steps, after the Launchpad demo: planned before a deploy, lit as one runs, done once live. */
  function track(p, mode) {
    const s = proj(p), c = s.check, r = s.run, branch = esc(c.repo?.branch || "main");
    const LAB = { done: ["Pushed", "Built", "Released", "Live"], doing: ["Pushing", "Building", "Releasing", "Going live"], failed: ["Didn't push", "Didn't build", "Didn't release", "Didn't answer"], paused: ["Paused", "Paused", "Paused", "Paused"], todo: ["Push", "Build", "Release", "Live"] };
    let st = ["todo", "todo", "todo", "todo"], meta;
    if (mode === "preview") {
      const gh = !c.github ? "" : !c.github.connected ? "GitHub isn't connected" : !c.github.workflow ? "Needs GitHub's workflow permission" : "";
      meta = [`${branch} to GitHub`, gh ? `<span class="lq-need">${gh}</span>` : "On GitHub Actions", "On Launchpad", "At its own address"];
    } else if (mode === "live") {
      const a = r?.live || c.app || {}, [tone] = c.app?.status && !r?.live ? appState(c.app.status) : ["go"];
      const commit = r?.live?.commit || c.app?.commit || "", at = a.at || c.app?.at, release = r?.release || a.release || c.app?.release;
      const ready = c.app?.ready, of = c.app?.of;
      st = ["done", "done", "done", { go: "done", work: "doing", stop: "failed" }[tone] || "todo"];
      meta = [commit ? `<code>${esc(commit)}</code>` : branch, at ? ago(at) : "On GitHub Actions", release ? `#${release}` : "", of ? `${ready ?? of} of ${of} ready` : ""];
    } else {
      const said = (t) => t && r.error && (t === r.error.text || t === r.error.message);
      st = NODES.map((n) => { const x = r.steps[n]?.state; return x === "doing" ? (r.lost ? "paused" : "doing") : x === "done" || x === "failed" || x === "paused" ? x : "todo"; });
      meta = NODES.map((n, i) => {
        const x = r.steps[n] || {}, text = x.text && !said(x.text) ? esc(x.text) : "";
        const logs = n === "build" && x.url ? ` · <a class="lp-ln" href="${esc(x.url)}" target="_blank" rel="noopener">Logs</a>` : "";
        if (st[i] === "doing") return `${since(x.at || r.startedAt)}${logs}`;
        if (n === "release" && x.of) return `${x.ready} of ${x.of} ready`;
        if (n === "release" && r.release) return `#${r.release}`;
        return text ? `${text}${logs}` : st[i] === "todo" ? "" : logs.slice(3);
      });
    }
    const at = st.reduce((m, x, i) => (x === "todo" ? m : i), 0);
    const tone = st.includes("failed") ? " t-stop" : st.includes("doing") ? " t-work" : st.includes("paused") ? "" : st[0] === "done" ? " t-go" : "";
    const cls = { done: " is-done", doing: " is-now", failed: " is-bad", paused: " is-paused", todo: "" };
    return `<ol class="lq-track${tone}" data-at="${at}" aria-label="${esc(`${nameOf(p)}'s deploy: push, build, release, live`)}">` +
      NODES.map((n, i) => `<li class="lq-st${cls[st[i]]}"><i aria-hidden="true"></i><b>${LAB[st[i]][i]}</b>${meta[i] ? `<span>${meta[i]}</span>` : ""}</li>`).join("") + `</ol>`;
  }

  /** What the app runs from and on: only what Space reports; Change opens its settings (a linked app). */
  function details(p) {
    const s = proj(p), c = s.check, f = s.form || {}, ca = c.app, r = s.run;
    const row = (k, v, end = "") => `<div class="lq-row"><span class="lq-k">${k}</span><span class="lq-v">${v}</span>${end}</div>`;
    const change = (label, what) => (ca && !ca.gone ? `<button type="button" class="lq-go lp-a" data-lp="edit" aria-label="${esc(`${label} ${what}`)}">${label}${ICON.right}</button>` : "");
    const admin = c.repo && (c.repo.admin || !c.github?.connected);
    const rows = [];
    if (c.repo) rows.push(row("Source", admin ? `${esc(c.repo.full)}<small>${esc(c.repo.branch || "main")} · builds on every push</small>` : `<span title="You're not an admin on ${esc(c.repo.full)}, so Launchpad can't add its build there">A private copy in your GitHub</span> <span class="lp-new">new</span>`));
    if (ca && (ca.size || ca.sizeLabel)) rows.push(row("Machine", `${esc(sizeText(c, ca.size, ca.sizeLabel))}${ca.storage ? `<small>${esc(String(ca.storage.gb))} GB disk at <code>${esc(ca.storage.path)}</code></small>` : ""}`, change("Change", "the machine")));
    const port = r?.error?.port || f.port || "";
    if (port) rows.push(row("Port", `<code>${esc(String(port))}</code>`));
    if (c.env?.length) rows.push(row("Environment", `${c.env.filter((x) => x.set).length} of ${c.env.length} set`, change("Edit", "the environment")));
    return rows.length ? `<p class="lq-h">Details</p><div class="lq-group">${rows.join("")}</div>` : "";
  }

  /** The one thing to do next, lit, in a card that says why; the other ways beside it, quieter. */
  const rec = (title, text, act, label, icon = "", s = null, alts = "", tone = "") => {
    const asking = s && s.asking && /^ask/.test(act), err = s && !s.asking && s.askErr && /^ask/.test(act) ? s.askErr : "";
    return `<div class="lq-note lp-rec${tone ? ` t-${tone}` : ""}"><div class="lq-nc"><b>${title}</b><p>${text}</p>${err ? `<p class="lp-err" role="status">Couldn't start the thread: ${esc(err)}.</p>` : ""}</div>` +
      `<div class="lq-acts">${alts}<button type="button" class="btn btn-pri lp-go" data-lp="${act}"${asking ? ' aria-disabled="true"' : ""}>${asking ? '<i class="lp-arc" aria-hidden="true"></i><span>Starting a thread…</span>' : `${icon}<span>${err ? "Try again" : label}</span>`}</button></div></div>`;
  };
  const span = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  /** A decision's own lit button above the form: not when the form is the answer (settings), nor done outside */
  const lit = (nd) => { const a = nextStep(nd.action, nd.data); return a && a[1] !== "settings" && a[1] !== "retry" && a[1] !== "log" ? a : null; };
  const fixOf = (e) => (e.fix ? `<p class="lp-note">${esc(e.fix)}</p>` : "");
  /** Space's next step as the lit button; done outside the window, only a quiet way back once it's done */
  const actionHtml = (e) => {
    const a = nextStep(e.action);
    if (!a) return e.action === "none" ? "" : `<div class="lq-acts lp-acts">${btn("retry", "Deploy again once that's done", ICON.retry)}</div>`;
    if (a[1] === "log") return e.url ? `<div class="lq-acts lp-acts">${out(e.url, a[0], true)}</div>` : "";
    return `<div class="lq-acts lp-acts">${btn(a[1], a[0], a[1] === "reconnect" ? LP_ICON.github : a[1] === "retry" ? ICON.retry : "", true)}</div>`;
  };
  /** A gh login on this machine without `workflow`: Space's command, to copy, and a way to check again. */
  const ghCmd = (fix) => /`([^`]+)`/.exec(fix || "")?.[1] || "";
  const cmdHtml = (cmd, s) => { const on = s && s.cmdCopied > Date.now(); return `<div class="lp-cmd"><code>${esc(cmd)}</code><button type="button" class="lp-ib" data-lp="cmd-copy" data-v="${esc(cmd)}" title="${on ? "Copied" : "Copy the command"}" aria-label="Copy the command">${on ? ICON.check : ICON.copy}</button></div>`; };

  /** Where launchpad.json sends the code, and where git's origin points: both whole, so the person sees the difference. */
  const repoFacts = (nd) => {
    const d = nd.data || {};
    return `<p>launchpad.json names ${d.repo ? `<code>${esc(d.repo)}</code>` : "a repository"}. ${d.origin ? `This project's git origin is <code>${esc(d.origin)}</code>.` : "This project has no git origin."}</p>`;
  };

  /** The apps a push would also deploy (Space's other_apps): each by its slug, or by its workflow file when it has none,
   *  and where the push goes. */
  const appsFacts = (nd) => {
    const d = nd.data || {}, apps = Array.isArray(d.apps) ? d.apps : [];
    return `<p>${d.repo ? `A push to <code>${esc(d.repo)}</code>${d.branch ? ` (<code>${esc(d.branch)}</code>)` : ""}` : "A push"} also deploys:</p>` +
      (apps.length ? `<ul class="lp-also">${apps.map((a) => `<li><code>${esc(a.slug || a.id || "")}</code>${a.slug && a.workflow ? ` <span>from <code>${esc(a.workflow)}</code></span>` : !a.slug ? " <span>(a workflow file)</span>" : ""}</li>`).join("")}</ul>` : "");
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
    const sm = editing ? summary(p) : null;
    const decline = nd?.code === "confirm_repo" ? btn("decline-repo", "Not this repository") : nd?.code === "other_apps" ? btn("decline-apps", "Don't push") : "";
    return (editing ? top({ tone: sm.tone, words: sm.words, title: `${esc(nameOf(p))}'s settings`, sub: `Change what you need; ${c.behind ? `it deploys again with them, and with ${esc(c.repo.branch || "main")}'s commits since the live release` : "the live commit is built again with them"}. Values left empty stay as they are on Launchpad.` })
      : top({ words: "Not on the web yet", title: `Put ${esc(nameOf(p))} on the web`, sub: guessed ? "Found these in the project. Check them, then deploy." : "Launchpad builds it on every push and runs it at an address of its own. Nothing goes out until you press Deploy." })) +
      askedHtml(p) +
      (nd ? `<div class="lq-note lp-rec lp-ask t-need"><div class="lq-nc"><b>${esc(nd.message || "")}</b>${nd.fix ? `<p>${esc(nd.fix)}</p>` : ""}${nd.code === "confirm_repo" ? repoFacts(nd) : nd.code === "other_apps" ? appsFacts(nd) : ""}</div>${decline || lit(nd) ? `<div class="lq-acts">${decline}${lit(nd) ? btn(lit(nd)[1], esc(lit(nd)[0]), "", true) : ""}</div>` : ""}</div>` : "") +
      (c.blockers.length ? `<p class="lp-note t-need">Deploy would stop here: ${esc(c.blockers.join("; "))}.</p>` : "") +
      // what Space warned of before the button is pressed (a repository that isn't the person's own, uncommitted changes, …)
      (c.warnings.length ? c.warnings.map((w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("") : "") +
      (editing ? "" : track(p, "preview")) +
      (c.github.source === "gh" && c.github.connected && !c.github.workflow && ghCmd(c.github.fix) ? `<div class="lp-gh"><p class="lp-note">Or grant it to this machine's gh login, then check again:</p>${cmdHtml(ghCmd(c.github.fix), s)}<div class="lq-acts">${s.pre === 1 ? `<button type="button" class="btn lp-b" data-lp="recheck-gh" aria-disabled="true"><i class="lp-arc" aria-hidden="true"></i><span>Checking GitHub…</span></button>` : btn("recheck-gh", "I ran it: check again", ICON.retry)}</div>${s.ghErr ? `<p class="lp-err lp-gh-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` : "") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src" title="This thread's work goes out once it's merged into ${esc(c.repo.branch || "main")}">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b>, not this thread's branch.</span></p>` : "") +
      `<p class="lq-h">Setup</p><div class="lq-group lp-set">` +
      (editing ? "" : field("name", "Name", f.name, { hint: e.name || "It can't change later.", bad: !!e.name, fix: e.nameFix })) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${esc(where(c.portFrom))}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      machineRows(s, c, f, e, editing) +
      // once a repository name had to be chosen, its field stays while you change it (a fixed error mustn't make it vanish)
      (e.repo || f.repoChosen ? field("repo", "Repository", f.repo, { hint: e.repo || hintFor("repo", p), bad: !!e.repo }) : "") +
      `</div>` +
      (env.length ? `<p class="lq-h" id="lq-env">Environment${from ? ` <span>from ${esc(from)}</span>` : ""}</p><fieldset class="lq-group lp-env" aria-labelledby="lq-env">` +
        mine.map((x) => `<label class="lq-row lp-f lp-ev"><span class="lq-k lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><span class="lq-v lp-v"><input class="lq-in lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(editing && x.set ? "Set · leave to keep" : x.default || "Not set")}" aria-label="${esc(x.name)}"></span><span class="lq-ed" aria-hidden="true">${ICON.edit}</span></label>`).join("") +
        (rest ? `<button type="button" class="lq-row lq-more lp-a lp-more" data-lp="env-all"><span>${rest} more with example values</span>${ICON.chevron || ""}</button>` : "") +
        `</fieldset><p class="lp-lock">${ICON.lock}<span>Straight to Launchpad; XO never keeps them.</span></p>` : "") +
      `<div class="lq-foot lp-foot">` +
      (editing ? `<button type="button" class="lq-link lp-a" data-lp="edit-cancel"><span>Cancel</span></button>`
        : `<button type="button" class="lq-link lp-a" data-lp="pick">${LP_ICON.link}<span>Link an app already on Launchpad</span></button>`) +
      `<div class="lq-acts">` + (scope
        ? `<button type="button" class="btn lp-go${nd && lit(nd) ? " is-quiet" : " btn-pri"}" data-lp="deploy">${LP_ICON.rocket}<span>${editing ? "Deploy with these" : `Deploy ${esc(f.name || nameOf(p))}`}</span></button>`
        : btn("reconnect", c.github.connected ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github, true)) + `</div></div>`;
  }
  /** A row of the Setup group: its label, the value or field with its hint under it, and what changes it. */
  const row = (label, inner, bad = false, tag = "div", end = "") => `<${tag} class="lq-row lp-f${bad ? " is-bad" : ""}"><span class="lq-k lp-l">${label}</span>${inner}${end}</${tag}>`;
  const PEN = `<span class="lq-ed" aria-hidden="true">${ICON.edit}</span>`;
  /** The machine: for a new app, its size (only what the template allows, its default chosen) and an optional disk;
   *  in a linked app's settings, the size it was made with (fixed) and its disk, which can grow but never shrink. */
  function machineRows(s, c, f, e, editing) {
    const ids = (id) => `aria-describedby="lp-h-${id}"${e[id] ? ' aria-invalid="true"' : ""}`;
    const hint = (id, text) => `<small class="lp-hint" id="lp-h-${id}">${text}</small>`;
    if (editing) {
      const a = c.app;
      return (a.size || a.sizeLabel ? row("Size", `<span class="lq-v lp-v"><span class="lp-ro">${esc(sizeText(c, a.size, a.sizeLabel))}</span>${hint("size", "Fixed when it was created.")}</span>`) : "") +
        (a.storage === undefined ? "" : a.storage
          ? row("Disk", `<span class="lq-v lp-v"><span class="lp-pair"><input class="lq-in lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u lp-at">GB at <code>${esc(a.storage.path)}</code></span></span>${hint("disk", e.disk || "Grows, never shrinks.")}</span>`, !!e.disk, "label", PEN)
          : row("Disk", `<span class="lq-v lp-v"><span class="lp-ro">None</span>${hint("disk", "Can't be added after creation.")}</span>`));
    }
    // a Space that offers sizes (xo-space 3886701 on): folded to one row until you change it; an older one, nothing
    const z = c.sizes, at = f.size || z?.def || "";
    if (!z) return "";
    if (!(s.machine || e.size || e.disk)) {
      const t = z.tiers.find((x) => x.name === at);
      return row("Machine", `<span class="lq-v lp-v"><span class="lp-ro">${esc(t ? t.label : "Launchpad's default")}</span><small>${esc(t ? `${t.cpu} CPU · ${t.memory_gb} GB memory` : "Its size, as Launchpad picks")}${f.disk ? ` · ${esc(f.diskGb)} GB disk` : ""}</small></span>`, false, "div",
        `<button type="button" class="lq-go lp-a lp-chg" data-lp="machine-open" aria-label="Change the machine">Change${ICON.right}</button>`);
    }
    // the app's one dropdown (<xo-select>, js/dropdown.js), never the browser's own <select> (the owner's decision);
    // its row is a div, not a label, so a click on the word Size doesn't open the list
    return row("Size", `<span class="lq-v lp-v"><xo-select class="lp-xs" data-lp-f="size" aria-label="Size" ${ids("size")}>${z.def ? "" : `<option value=""${at ? "" : " selected"}>Launchpad's default</option>`}` +
        z.tiers.map((t) => `<option value="${esc(t.name)}"${at === t.name ? " selected" : ""}${t.name === z.def ? ' data-desc="Default"' : ""}>${esc(`${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB`)}</option>`).join("") +
        `</xo-select>${hint("size", e.size || sizeHint(c, f))}</span>`, !!e.size) +
      (f.disk
        ? row("Disk", `<span class="lq-v lp-v"><span class="lp-pair"><input class="lq-in lp-in lp-mono" data-lp-f="diskPath" value="${esc(f.diskPath)}" placeholder="/data" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Where the disk is mounted" ${ids("disk")}><input class="lq-in lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u">GB</span></span>${hint("disk", e.disk || "Grows later, never shrinks.")}</span>`, !!e.disk, "div",
          `<button type="button" class="lp-ib" data-lp="disk-remove" title="No disk" aria-label="No disk">${ICON.close}</button>`)
        : row("Disk", `<span class="lq-v lp-v"><span class="lp-ro">None</span>${hint("disk", "Only at creation")}</span>`, false, "div",
          `<button type="button" class="lq-go lp-a lp-add" data-lp="disk-add">${ICON.plus}<span>Add a disk</span></button>`));
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
    // the field sits on its row, borderless, its hint under it on the same edge; Launchpad's free name is a button under the hint
    return row(label, `<span class="lq-v lp-v"><input class="lq-in lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><small class="lp-hint" id="lp-h-${id}">${hint}</small>${fix ? `<button type="button" class="btn lp-b lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span>`, bad, "label", PEN);
  }

  /** What Space warned of on the way (uncommitted changes left out, env names with no value): worth reading, not fatal. */
  const warnHtml = (s) => (s.warn || []).map((w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("");
  const appName = (p) => esc(proj(p).form?.name || proj(p).check?.app?.name || nameOf(p));

  function runHtml(p) {
    const s = proj(p), r = s.run, name = appName(p), was = s.check.app;
    if (r.undo) return top({ tone: "work", words: "Starting", title: name, sub: `Deploying ${name} in <span class="lp-count" data-until="${r.undo}">${Math.max(1, Math.ceil((r.undo - Date.now()) / 1000))}</span> s.`, acts: btn("undo", "Undo", ICON.undo) }) + track(p, "run");
    const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo", rel = r.steps.release || {}, build = r.steps.build || {};
    const word = { repo: "Pushing", build: "Building", release: `Rolling out${r.release ? ` #${r.release}` : ""}`, live: "Going live" }[on];
    const sentence = on === "release" && rel.of
      ? `${rel.ready} of ${rel.of} new instance${rel.of > 1 ? "s" : ""} ${rel.of > 1 ? "are" : "is"} ready.${was?.release ? ` Release #${was.release} keeps serving until the new one is healthy.` : ""}`
      : `${{ repo: `Pushing ${esc(s.check.repo.branch || "main")} to GitHub.`, build: "GitHub Actions is building the image.", release: "Launchpad is starting the new release.", live: "Going live." }[on]}${was?.release && on !== "release" ? ` Release #${was.release} keeps serving.` : ""}`;
    // Stop's 3 s: the stop can still be taken back, here where it was asked for (the notice's Undo does the same);
    // then it's out, and only Space's receipt says it stopped (G6)
    const q = r.stopErr ? `<p class="lp-q t-need" role="status">Couldn't stop it: ${esc(r.stopErr)}. It's still deploying.</p>`
      : r.stopSent ? `<p class="lp-q" role="status">Stopping… it stops once Space confirms.</p>`
      : r.stopping ? `<p class="lp-q" role="status">Stops in <span class="lp-count" data-until="${r.stopAt}">${Math.max(1, Math.ceil((r.stopAt - Date.now()) / 1000))}</span> s.</p>`
      : `<p class="lp-q">You can close this window. It carries on, and Coworker tells you when it's live.</p>`;
    const stop = r.stopSent ? `<button type="button" class="btn lp-b" data-lp="stop" aria-disabled="true"><i class="lp-arc" aria-hidden="true"></i><span>Stopping…</span></button>`
      : r.stopping ? btn("stop-undo", "Keep deploying")
      : btn("stop", r.stopErr ? "Stop again" : "Stop", ICON.stop);
    return top({ tone: "work", words: word, meta: `${since(r.startedAt)} in all`, title: name, addr: addrHtml(s, was), sub: sentence, acts: stop + (build.url ? out(build.url, "Show log") : "") }) +
      track(p, "run") + q + warnHtml(s) + details(p);
  }

  /** The stream dropped and couldn't be picked up: the deploy carries on in Space, nothing here spins */
  function lostHtml(p) {
    return top({ words: "Lost touch", title: appName(p), sub: "The deploy carries on in Space. Follow it again to see where it is.", acts: btn("rewatch", "Follow it again", ICON.retry, true) }) + track(p, "run");
  }

  function liveHtml(p) {
    const s = proj(p), a = s.run?.live || s.check.app, name = appName(p);
    const appUrl = launchpadUrl(s.run?.appId || s.check.app?.id);
    if (a.gone) return top({ tone: "stop", words: "App not on Launchpad", title: `${name}'s app is gone`, sub: "Launchpad has no such app for you: it was deleted, or it is someone else's. Its repository, port and settings are still here." }) +
      rec("Create it again", "A new app from the same repository, with the same settings.", "recreate", "Create it again", LP_ICON.rocket, null, btn("unlink", "Unlink"));
    const [tone, words] = a.status && !s.run?.live ? appState(a.status) : ["go", "Live"];
    const rel = a.release || s.check.app?.release;
    const sentence = tone === "go" ? "" : tone === "work" ? `A new release is rolling out${rel ? `; release #${rel} keeps serving until it's healthy` : ""}.` : tone === "stop" ? "Its instances aren't answering. Deploying again, or the logs in Launchpad, say why." : `${name} isn't serving.`;
    const menu = `<span class="lp-mw"><button type="button" class="lp-ib lq-more-b" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" aria-controls="lp-mn" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-mn" id="lp-mn" role="menu" aria-label="More" tabindex="-1">${appUrl ? `<a role="menuitem" tabindex="-1" href="${esc(appUrl)}" target="_blank" rel="noopener">Open in Launchpad</a>` : ""}<button type="button" role="menuitem" tabindex="-1" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span>`;
    return top({ tone, words: tone === "go" ? "Live" : words, meta: rel ? `Release #${rel}${a.at ? ` · ${ago(a.at)}` : ""}` : a.at ? ago(a.at) : "", title: name, addr: addrHtml(s, a, tone === "go"), sub: sentence,
      acts: btn("again", "Deploy again", LP_ICON.rocket) + (a.url ? out(a.url, "Open", true) : "") + menu }) +
      askedHtml(p) + track(p, "live") + (s.run?.live ? warnHtml(s) : "") + details(p);
  }

  function failedHtml(p) {
    const s = proj(p), e = s.run.error, name = appName(p), was = s.check.app;
    const head = (tone, sub, acts = "") => top({ tone, words: failWords(e), meta: e.release ? `Release #${e.release}` : "", title: name, addr: addrHtml(s, was), sub, acts });
    if (e.code === "build_failed") return head("stop", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", e.url ? out(e.url, "Logs on GitHub") : "") +
      track(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", "", s, btn("retry", "Try again", ICON.retry), "stop") + details(p);
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return head("stop", "") + track(p, "run") +
      rec(`Nothing answered on port ${e.port}`, `The image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "fix-port", `Use port ${e.declared}`, "", null, btn("retry", "Try again", ICON.retry), "stop") + details(p);
    if (NEEDS_YOU.has(e.code)) return top({ tone: "need", words: failWords(e), title: e.code === "github_workflow_scope" ? "GitHub needs one more permission" : "GitHub isn't connected", sub: e.code === "github_workflow_scope" ? "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes." : esc(e.message || "") }) +
      track(p, "run") + (e.source === "gh" && ghCmd(e.fix)
        ? `<div class="lq-note lp-rec"><div class="lq-nc"><b>Grant it to this machine's gh login</b><p>Run this, then check again.</p>${cmdHtml(ghCmd(e.fix), s)}${s.ghErr ? `<p class="lp-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div><div class="lq-acts">${btn("reconnect", "Reconnect GitHub here", LP_ICON.github)}${btn("recheck-gh", "I ran it: check again", ICON.retry, true)}</div></div>`
        : rec("Reconnect GitHub", "Grant it once; then deploy again.", "reconnect", e.code === "github_workflow_scope" ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github));
    return top({ tone: "stop", words: failWords(e), title: `${name} didn't deploy`, addr: addrHtml(s, was), sub: esc(e.message || e.text || "Something went wrong on the way.") }) + track(p, "run") +
      fixOf(e) + actionHtml(e) + details(p);
  }

  /** What the app reports about the thread an Ask started: that exact thread (by id), else nothing known. Working
   *  (and its arc, and its clock) only when its agent is at work; never a guess (Astra: idle or unreported threads
   *  were drawn Working). */
  function askState(p, g) {
    const t = g && g.thread ? findThread(p, g.thread) : null, mine = t && t.thread === g.thread ? t : null;
    if (!mine) return { k: "unknown", word: "Started · its status isn't reported yet" };
    if (mine.done) return { k: "done", word: "Done: merge its work, then deploy" };
    if (mine.busy) return { k: "work", word: "Working" };
    // held back by a gate (the usage limit…): it waits to start, said as the thread says it
    if (mine.held) return { k: "idle", word: mine.held };
    return { k: "idle", word: "Not working right now" };
  }
  const askRow = (g, st) => `<ul class="lq-group lp-ag"><li><button type="button" class="lq-row lp-agr" data-lp="thread" data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${st.k === "work" ? ARC : ""}</span><span class="lq-v lp-c"><b>${esc(g.title)}</b><small>${esc(st.word)}</small></span><span class="lp-m">${st.k === "work" ? `<span class="lp-tm">${since(g.since)}</span>` : ""}${ICON.right}</span></button></li></ul>`;
  /** The thread an Ask (from a failed deploy) started: its row, with what it means for deploying. */
  function askedHtml(p) {
    const s = proj(p), g = s.asked;
    if (!g || s.check?.state === "needs-agent") return "";
    const st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Merge its work, then deploy again here." : st.k === "work" ? "An agent is fixing it. Deploy again here once its work is merged." : "A thread was started to fix it. Deploy again here once its work is merged.";
    return `<div class="lp-asked"><p class="lq-h">${line}</p>${askRow(g, st)}</div>`;
  }

  function needsHtml(p) {
    const c = proj(p).check;
    return top({ words: "Not ready yet", title: `${esc(nameOf(p))} needs preparing first`, sub: "Launchpad can't tell how to run it as it is. An agent can prepare it." }) +
      (c.missing.length ? `<p class="lq-h">What Launchpad looks for</p><ul class="lq-group lp-check">${c.missing.map((m) => `<li class="lq-row ${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lq-v lp-c"><b>${esc(cap(m.what))}</b>${m.why ? `<small>${esc(m.why)}</small>` : ""}</span></li>`).join("")}</ul>` : "") +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", "", proj(p));
  }

  function gettingHtml(p) {
    const s = proj(p), g = s.check.getting || findThread(p) || s.asked, st = askState(p, g), sm = summary(p);
    const line = st.k === "done" ? "Its agent says it's done. Once its work is merged, Deploy is ready here." : st.k === "work" ? "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here." : "A thread was started to add what Launchpad needs. Once its work is merged, Deploy is ready here.";
    return top({ tone: sm.tone, words: sm.words, title: `Getting ${esc(nameOf(p))} ready`, sub: line }) + askRow(g, st) + track(p, "preview");
  }

  function deviceHtml(p) {
    const d = proj(p).device, wait = (w) => `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    if (!d.code) return top({ tone: "need", words: "Waiting for GitHub", title: "Connecting GitHub…", sub: "A GitHub login this machine already has is used as it is." }) + wait("Asking Space.");
    return top({ tone: "need", words: "Waiting for GitHub", title: "Connect GitHub", sub: "Enter this code on GitHub. It grants the <code>workflow</code> permission Launchpad needs." }) +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code>${btn("code-copy", d.copiedUntil > Date.now() ? "Copied" : "Copy", d.copiedUntil > Date.now() ? ICON.check : ICON.copy)}</div>` +
      wait("Waiting for GitHub. This carries on by itself.") +
      `<div class="lq-foot"><button type="button" class="lq-link lp-a" data-lp="device-cancel"><span>Cancel</span></button><div class="lq-acts"><a class="btn btn-pri lp-go" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a></div></div>`;
  }

  function pickHtml(p) {
    const s = proj(p), list = s.picking?.apps;
    const wait = (w) => `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    return top({ title: "Link an app on Launchpad", sub: `${esc(nameOf(p))} deploys to the app you pick from now on.` }) +
      (s.linking ? wait("Linking…") : !list ? wait("Reading your apps…") : !list.length ? `<p class="lp-note">No apps on Launchpad yet.</p>` :
        `<p class="lq-h">Your apps on Launchpad</p><ul class="lq-group lp-also">${list.map((a) => `<li><button type="button" class="lq-row lp-appr" data-lp="link" data-id="${esc(a.id)}"${a.linkable ? "" : ` disabled title="Not built from GitHub, so XO can't deploy to it"`}><span class="lp-t">${LP_ICON.app}</span><span class="lq-v lp-c"><b>${esc(a.name)}</b>${a.linkable ? `<small class="lp-mono">${esc(a.host)}</small>` : "<small>Not built from GitHub: XO can't deploy to it</small>"}</span><span class="lp-m">${((t, w) => eye(t === "stop" ? "stop" : t, esc(w)))(...appState(a.status))}</span></button></li>`).join("")}</ul>`) +
      `<div class="lq-foot"><button type="button" class="lq-link lp-a" data-lp="pick-cancel">${ICON.back}<span>Back</span></button></div>`;
  }

  function checkingHtml(p) {
    return top({ words: "Checking…", title: `Checking ${esc(nameOf(p))}…`, sub: "Its repository, its port and what it needs to run." }) +
      `<ol class="lq-track is-skel" aria-hidden="true">${"<li class=\"lq-st\"><i></i><b></b><span></span></li>".repeat(4)}</ol>`;
  }

  function bodyHtml(p) {
    const sc = screen(p);
    const s = proj(p), c = s.check;
    return {
      key: `${p}|${sc}` + (sc === "setup" ? `|${formKey(c, { pre: s.pre, needs: s.needs && [s.needs.code, s.needs.message, s.needs.fix, s.needs.action, s.needs.data?.repo, s.needs.data?.origin, s.needs.data?.branch, (s.needs.data?.apps || []).map((a) => `${a.id}/${a.slug || ""}/${a.workflow || ""}`).join()], errs: s.form.errs || {}, envAll: !!s.envAll, editing: !!s.editing, machine: !!s.machine, disk: !!s.form.disk, thread: !!S.v?.startsWith("t:"), ghErr: s.ghErr || "", asked: !!s.asked })}` : ""),
      html: sc === "checking" ? checkingHtml(p) : sc === "check-failed" ? top({ words: "Couldn't check", title: "Couldn't check this project", sub: esc(proj(p).err?.message || "XO Space didn't answer."), acts: btn("recheck", "Try again", ICON.retry) })
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

  // ── painting into the window lpwindow.js made ───────────────────────────────
  function paint(v, open) {
    if (!S.el) return;
    const p = projectOf(v);
    if (S.shown && (S.shown !== p || !open)) forget(S.shown);
    S.shown = open && p ? p : null;
    S.v = v;
    if (!p) return;
    const sm = summary(p);
    S.el.dataset.tone = sm.tone;
    const hs = `<span class="lp-st t-${sm.tone}"><i aria-hidden="true"></i><span>${esc(sm.words)}</span>${sm.at ? ` <span class="lp-tm">${since(sm.at)}</span>` : ""}</span>`;
    if (S.hs && S.hs._h !== hs) { redraw(S.hs, hs); S.hs._h = hs; }
    if (S.nav) {
      const s = proj(p), on = s.editing && s.check?.app ? "edit" : "home";
      const nav = `<button type="button" class="nrow${on === "home" ? " is-on" : ""}" data-lp="${on === "home" ? "home" : "edit-cancel"}"${on === "home" ? ' aria-current="page"' : ""}><span class="nr-ic">${xi("dashboard")}</span><span>Overview</span></button>` +
        (s.check?.app && !s.check.app.gone && !s.run ? `<button type="button" class="nrow${on === "edit" ? " is-on" : ""}" data-lp="edit"${on === "edit" ? ' aria-current="page"' : ""}><span class="nr-ic">${xi("settings-general")}</span><span>Settings</span></button>` : "");
      if (S.nav._h !== nav) { redraw(S.nav, nav); S.nav._h = nav; }
    }
    if (!open) return;
    preflight(p);
    const b = bodyHtml(p);
    // a form is drawn once per screen, never under the person's fingers; the rest redraws when it changes
    if (b.form && S.key === b.key && S.body.querySelector(".lp-set")) { syncPreview(p); return; }
    // a clock's figures aren't a change (the app's ticker moves them); a new screen arrives, the same one doesn't
    const same = b.html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1").replace(/(class="lp-count"[^>]*>)\d+/g, "$1");
    if (S.key !== b.key || S.html !== same) {
      const ae = document.activeElement && S.body.contains(document.activeElement) ? (document.activeElement.closest("xo-select") || document.activeElement) : null;
      // the focused control by what it is, and which of its kind (Change shows on two rows)
      const [focus, nth] = ae && ae !== S.body ? keyOf(ae) : [null, 0];
      const caret = ae && ae.matches("input") ? [ae.selectionStart, ae.selectionEnd] : null;
      const fresh = S.key.split("|").slice(0, 2).join("|") !== b.key.split("|").slice(0, 2).join("|");
      // in place (js/redraw.js): a control that stays is the same node, so a press on it still clicks as a deploy's
      // steps redraw the screen (the owner, 19 Nov); a new screen is a new node (its data-screen)
      redraw(S.body, `<div class="lp${fresh ? " is-new" : ""}" data-screen="${b.key.split("|")[1]}">${b.html}</div>`);
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
  /** As you type: Deploy's name and the size's hint follow the fields, and nothing else redraws. */
  function syncPreview(p) {
    const f = proj(p).form, sh = S.body.querySelector("#lp-h-size");
    if (sh && !f.errs?.size && sh.closest(".lp-f")?.querySelector("xo-select")) sh.textContent = sizeHint(proj(p).check, f);
    const go = S.body.querySelector('[data-lp="deploy"] span');
    if (go && !proj(p).editing) go.textContent = `Deploy ${f.name || nameOf(p)}`;
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
    const body = { name: f.name, port: Number(f.port), ...machine, ...(f.useRepo ? { use_repo: f.useRepo } : {}), ...(f.allowApps?.length ? { allow_apps: f.allowApps } : {}), ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.repoChosen ? f.repo : f.name }), ...(c.app && again && !f.recreate && (s.run.edit || !c.behind) ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((x) => x.sensitive).map((x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now(); s.run.sent = Object.keys(env); // names only: what goes live with this release
    s.needs = null; s.warn = null; f.recreate = false; f.allowApps = null; // recreate and allow_apps are asked once, not for every deploy after
    s.run.stop = api.deploy(p, body, (e) => event(p, e));
    if (S.shown !== p) f.env = {}; // sent with the section put away: nothing here to keep them for
    land('[data-lp="stop"]'); // Undo's time is up: it goes, Stop takes its place
    changed();
  }
  const visible = (p) => !!(S.el && S.shown === p && S.el.open !== false);

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
      if (ours()) { s.device = null; land('[data-lp="reconnect"]'); tell("GitHub's code ran out. Reconnect again.", null, "err"); changed(); }
    } catch (e) { if (!ours()) return; s.device = null; land('[data-lp="reconnect"]'); tell(`GitHub didn't connect: ${e.message}`, null, "err"); changed(); }
  }

  async function startPick(p) {
    const s = proj(p);
    s.picking = { apps: null };
    land('[data-lp="pick-cancel"]'); // Back, while it reads; the list arrives under it
    changed();
    try { const apps = await api.apps(p); if (s.picking) s.picking.apps = apps; } // Back meanwhile: nothing to fill
    catch (e) { s.picking = null; land('[data-lp="pick"]'); tell(`Couldn't read your Launchpad apps: ${e.message}`, null, "err"); }
    changed();
  }

  /** Link an app on Launchpad, then read the project afresh: lpapi's preflight builds on the last check, which
   *  doesn't know the link yet, and link answers before Launchpad has a status. */
  function link(p, id) {
    const s = proj(p);
    s.picking = null; s.linking = true; land('[data-lp="pick-cancel"]'); changed();
    api.link(p, id)
      .then((a) => { s.check = { ...s.check, state: "linked", app: a }; s.run = null; land('[data-lp="again"]'); load(p, true); })
      .catch((e) => { land('[data-lp="pick"]'); tell(`Couldn't link it: ${e.message}`, null, "err"); })
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
   *  Undo brought back, and only onto a control a person can reach: sel in p's open window; else the header's Deploy
   *  for p; else the page's work (the notice isn't about it: never another project's Deploy). */
  function fromNotice(p, sel) {
    const reach = (el) => !!(el && el.getClientRects().length && !el.closest("[inert]"));
    const go = (el) => { el.focus({ preventScroll: true }); return true; };
    const n = visible(p) && S.body.querySelector(sel);
    if (reach(n)) return go(n);
    const d = projectOf(S.v) === p && [...document.querySelectorAll("[data-lp-open]")].find(reach);
    if (d) return go(d);
    const w = ["scroller", "home"].map((id) => document.getElementById(id)).find(reach);
    if (w) return go(w);
    return false;
  }

  /** The ⋯ menu: opens with focus on its first item; closes back onto More (when focus was in it). */
  function menu(p, open, focusIn = false) {
    const s = proj(p);
    if (s.menu === open) return;
    const inside = !open && !!S.body?.querySelector(".lp-mn")?.contains(document.activeElement);
    if (inside) land('[data-lp="menu"]'); // its item goes with it: focus back on More
    s.menu = open; changed();
    if (open && focusIn) requestAnimationFrame(() => focusOpened(S.body?.querySelector('.lp-mn'), focusIn === true ? undefined : focusIn));
  }

  /** A copy that says "Copied" only once the text is on the clipboard (util.copyText), and only for 1.5 s from that
   *  copy (each button's receipt is a time, never a lasting flag). Refused, it says why, focus stays on the button,
   *  and unmark() takes back what an earlier success still shows: a refusal never wears the last copy's "Copied". */
  async function copied(text, what, mark, unmark) {
    const ok = await copyText(String(text || ""));
    if (!ok) { unmark && unmark(); changed(); announce(COPY_REFUSED); tell(COPY_REFUSED, null, "err"); return; }
    mark(); announce(`Copied ${what}.`); changed();
    clearTimeout(S.copiedT); S.copiedT = setTimeout(changed, 1600); // the latest Copy's 1.5 s, not the first's
  }

  function act(name, el, e) {
    const p = projectOf(S.v);
    if (!p) return;
    const s = proj(p);
    switch (name) {
      case "deploy": deploy(p); return;
      case "undo": if (s.run) { s.run = null; s.form.allowApps = null; land('[data-lp="deploy"], [data-lp="again"], [data-lp="recreate"]'); announce("Deploy undone. Nothing changed."); changed(); } return;
      case "hide": onHide && onHide(); return;
      case "home": if (s.editing) { s.editing = false; s.form.env = {}; S.key = ""; changed(); } return;
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
      case "allow-apps": { // the push Space asked about, allowed once: the same deploy again, with every app's id (any left out and Space asks again)
        const ids = (s.needs?.data?.apps || []).map((a) => a.id).filter(Boolean), was = s.sent || {};
        if (!ids.length) return;
        s.form.allowApps = ids; s.form.recreate = !!was.recreate; s.editing = !!(was.edit && s.check?.app);
        s.needs = null; s.run = null; deploy(p, !!was.again); return;
      }
      case "decline-apps": s.needs = null; s.form.allowApps = null; s.run = null; S.key = ""; land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not pushing. Nothing changed."); changed(); return;
      case "decline-repo": s.needs = null; s.form.useRepo = ""; s.run = null; S.key = ""; land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not deploying to that repository. Nothing changed."); changed(); return;
      case "create-repo": s.check = { ...s.check, repo: { ...s.check.repo, admin: false } }; s.needs = null; s.run = null; deploy(p); return;
      case "link-same": { const id = s.needs?.data?.app?.id || s.run?.error?.app?.id; s.needs = null; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); if (id) api.link(p, id).then((a) => { s.check = { ...s.check, state: "linked", app: a }; deploy(p, true); }).catch((err) => tell(`Couldn't link it: ${err.message}`, null, "err")); changed(); return; }
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
      case "menu": menu(p, !s.menu, !s.menu && (e || true)); return;
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
      // the thread takes the place of what's shown, and focus goes to it: go() closes the window and places it
      case "thread": go && go(el.dataset.go); return;
      case "fix-port": s.form.port = String(s.run.error.declared); s.run = null; deploy(p); return;
      case "use-name": s.form.name = el.dataset.v; s.form.errs = {}; S.key = ""; land('[data-lp-f="name"]'); changed(); return;
      case "recheck": s.err = null; land(AFTER); load(p, true); changed(); return; // Checking… has nothing to press: the section holds focus
    }
  }
  let onHide = null;


  /** More below than the section shows: its foot fades rather than ending on a cut row. */
  function over() {
    const b = S.body;
    if (!b) return;
    const more = b.scrollTop + b.clientHeight < b.scrollHeight - 1;
    b.classList.toggle("is-over", more);
    b.classList.toggle("is-fade", more && !b.querySelector(".lp-foot")); // a section without a foot fades at its edge
  }

  function mount(section, { hide }) {
    S.el = section; S.hs = section.querySelector(".lp-hs"); S.nav = section.querySelector(".lq-nav"); S.notes = section.querySelector(".lq-notes"); S.body = section.querySelector(".fr-b");
    S.body.addEventListener("scroll", over, { passive: true });
    pointerFollows(S.body); // the ⋯ menu: the item under the mouse is the active one (C058)
    addEventListener("resize", over);
    onHide = hide;
    section.addEventListener("click", (e) => {
      const u = e.target.closest("[data-lq-undo]");
      if (u) { const mid = u.closest("[data-mid]")?.dataset.mid, n = N.get(mid); if (n) { drop(mid); drawNotes(); n.line.undo(); } return; }
      const b = e.target.closest("[data-lp]");
      if (!b || !section.contains(b)) { if (!e.target.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) menu(p, false); } return; }
      e.preventDefault();
      act(b.dataset.lp, b, e);
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
    // Esc in the ⋯ menu or an open list closes that, not the window: heard first, in the document's capture phase
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !S.body) return;
      const x = e.target.closest?.(".lq xo-select.is-open");
      if (x) { e.preventDefault(); e.stopPropagation(); x.close(true); return; } // the list closes, focus stays on Size
      if (!e.target.closest?.(".lq .lp-mw")) return;
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
    /** The window closed: what was typed in it goes with it; its notices go to the page's line. */
    away() { if (S.shown) forget(S.shown); handOver(); S.shown = null; },
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
    /** Press one of the open window's own buttons by its action, as a click would (the page's fixes). */
    press(name) { const b = S.body?.querySelector(`[data-lp="${name}"]`); if (b) act(name, b); },
    /** Every project's deploy at a glance, for the Launchpad page: each read once in a while, unknown ones left out. */
    overview(ps) {
      return ps.map((p) => {
        load(p);
        const s = P.get(p), c = s?.check;
        if (!c || c.state === "not-deployable") return null;
        const sc = screen(p), sm = summary(p), r = s.run, app = r?.live || c.app, e = r?.error;
        const ran = r && !r.live && r.steps;
        const steps = ran ? NODES.map((n) => r.steps[n]?.state || "") : app ? ["done", "done", "done", { go: "done", work: "doing", stop: "failed" }[sm.tone] || ""] : ["", "", "", ""];
        const port = e && e.code === "health_check_failed" && e.declared && e.declared !== e.port;
        const why = port ? `Nothing answered on port ${e.port}; the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}` : e ? e.message || e.text || failWords(e) : sm.tone === "stop" ? "Its instances aren't answering." : "";
        return { p, name: app?.name || s.form?.name || nameOf(p), kind: app || r ? "app" : sc === "needs" || sc === "getting" ? "needs" : "ready",
          tone: sm.tone, words: sm.words, at: sm.at || app?.at || 0, host: app?.host || "", url: app?.url || "", steps, log: e?.url || "",
          need: sm.tone === "stop" || sm.tone === "need" ? { why, act: port ? "fix-port" : "", label: port ? `Use port ${e.declared}` : "" } : null };
      }).filter(Boolean);
    },
    /** Read what Space says about the view's project, once in a while. */
    ensure(v) { const p = projectOf(v); if (p) load(p); },
    /** The header's Deploy: what the project's deploy is doing, at a glance; it opens the window. */
    button(v, open) {
      const p = projectOf(v);
      if (!p || !this.has(v)) return "";
      const sm = P.get(p)?.check ? summary(p) : { tone: "", words: "" };
      const busy = sm.tone === "work";
      const label = busy ? "Deploying" : "Deploy";
      const tip = sm.tone === "go" ? `Live at ${sm.host}` : sm.tone === "stop" ? `${sm.words}: open Launchpad` : sm.tone === "need" ? "Launchpad waits for you" : busy ? `${sm.words} on Launchpad` : "Deploy on Launchpad";
      return `<button type="button" class="tw-act lp-btn${sm.tone ? ` t-${sm.tone}` : ""}${open ? " is-on" : ""}" data-lp-open aria-pressed="${!!open}" aria-haspopup="dialog" title="${esc(tip)}">${busy ? '<i class="lp-arc" aria-hidden="true"></i>' : LP_ICON.rocket}<span>${label}</span></button>`;
    },
  };
}
