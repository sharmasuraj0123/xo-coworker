// @ts-check

// What Space says about each project, and its deploy stream, one event at a time; and the screen and head that follow from them.
import { appState } from "./model.js";
import { NODES, NEEDS_YOU, WORD, CACHE, AGAIN_MS, ERR_MS, AFTER, newRun, slug, failWords } from "./words.js";

/** Adds the store to the section's shared state L. @param {any} L */
export function installStore(L) {
  const { api, S, proj, changed, land, announce, endStop, nameOf, findThread, notify, cached } = L;

  /** A read that will write the project's check takes a ticket; an older answer never overwrites a newer one. @param {any} s */
  const ticket = (s) => (s.seq = (s.seq || 0) + 1);
  /** @param {any} s @param {number} n */
  const current = (s, n) => { if (n <= (s.applied || 0)) return false; s.applied = n; return true; };
  /** A later read's answer has already applied: this one's outcome, success or refusal, changes nothing. @param {any} s @param {number} n */
  const stale = (s, n) => n <= (s.applied || 0);
  /** A recheck asked for (loud) says what the project's current check says about GitHub, whichever read answered last. @param {any} s */
  const sayGitHub = (s) => { s.loud = false; s.ghErr = null; announce(s.check.github?.workflow ? "GitHub has the workflow permission now." : "GitHub still doesn't have the workflow permission."); };
  /** @param {string} p @param {boolean} [force] */
  async function load(p, force = false) {
    const s = proj(p);
    if (s.loading || (!force && s.at && Date.now() - s.at < (s.err ? ERR_MS : AGAIN_MS))) return;
    s.loading = true; s.err = null;
    const n = ticket(s);
    try {
      // once preflight has answered, a refresh asks it again on the fresh check, so check's guesses never cover what GitHub and Launchpad said
      let c = await api.check(p);
      if (s.pre && api.preflight) c = await api.preflight(p, s.form?.name);
      if (!current(s, n)) { s.loading = false; return; } // a newer answer is already here
      s.check = c; s.at = Date.now(); s.err = null;
      if (!s.form) s.form = { name: slug(c.name || p), port: c.port ? String(c.port) : "", repo: c.repo?.create || slug(p), env: {}, errs: {}, size: c.size || "", disk: !!c.storage, diskPath: c.storage?.path || "", diskGb: String(c.storage?.gb || 2) };
      if (c.running && !s.run && c.running !== s.ended) watch(p); // never the run Space just said was over
      cached[p] = c.state;
      try { localStorage.setItem(CACHE, JSON.stringify(cached)); } catch { /* private mode */ }
    } catch (e) {
      // refused, but a newer read has answered since: that answer stands (an old refusal never flips a working screen to Couldn't check)
      if (stale(s, n)) { s.loading = false; changed(); return; }
      s.err = e; s.at = Date.now();
    }
    s.loading = false;
    changed();
  }

  /** One event off the deploy stream: its step's state and words; an error stops the run where it is. @param {string} p @param {any} e */
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
      // the run keeps the app's id: a preflight that started before the deploy finished must not take the link away
      r.appId = e.app?.id || r.appId || was.id || "";
      // the names this deploy carried are set on Launchpad now (their values went with the request, never kept here)
      const env = (s.check?.env || []).map((/** @type {any} */ x) => (r.sent?.includes(x.name) ? { ...x, set: true } : x));
      // its size and disk: what it had, else what this deploy made it with (preflight says Launchpad's own soon after)
      const made = r.made || {};
      s.check = { ...s.check, state: "linked", env, app: { id: e.app?.id || r.appId || was.id || "", name: e.app?.name || was.name, url: e.url, host: e.host, status: "live", release: e.release, at, commit: e.commit || was.commit,
        size: was.size || made.size || "", sizeLabel: was.sizeLabel || "", storage: made.storage !== undefined ? made.storage : was.storage } };
    }
  }

  /** Space's network answers, once the section is open; one at a time, and a recheck asked for meanwhile joins it (s.loud). @param {string} p */
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
      else if (s.loud) { s.loud = false; s.ghErr = /** @type {any} */ (e)?.message || "XO Space didn't answer"; announce(`Couldn't check GitHub: ${s.ghErr}.`); }
    }
    changed();
  }

  /** A deploy already running (another tab, another visit): its stream again, from the start. @param {string} p */
  function watch(p) {
    const s = proj(p);
    s.run = newRun();
    s.run.stop = api.watch(p, (/** @type {any} */ e) => event(p, e));
  }

  /** The stream, one event at a time: a decision goes back to the form, the rest onto the card. @param {string} p @param {any} e */
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
      else { if (e.code === "confirm_repo") f.useRepo = ""; if (e.code === "other_apps") f.allowApps = null; s.needs = e; } // a decision, lit, above the form (a confirmed repo Space asks again about is no longer confirmed)
      land(f.errs.name ? '[data-lp-f="name"]' : f.errs.port ? '[data-lp-f="port"]' : f.errs.repo ? '[data-lp-f="repo"]' : '.lp-ask .lp-go, [data-lp="deploy"], [data-lp="reconnect"]');
      S.key = ""; changed();
      if (f.errs.name || f.errs.port) requestAnimationFrame(() => S.body?.querySelector(`[data-lp-f="${f.errs.name ? "name" : "port"}"]`)?.focus());
      return;
    }
    if (e.state === "doing" || e.state === "done" || e.state === "failed") f.env = {}; // under way: the values have gone with the request
    // the stop we asked for, confirmed by the run itself
    if (e.state === "failed" && e.error?.code === "cancelled" && (s.run.stopSent || s.run.stopErr)) { L.stopped(p, s.run); return; }
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
    if (e.step === "live" && e.state === "done") { announce(`${name} is live.`); if (!L.visible(p)) notify && notify(`${name} is live`); }
    if (e.state === "failed") { announce(`${name} didn't deploy: ${failWords(s.run.error)}.`); if (!L.visible(p)) notify && notify(`${name}: ${failWords(s.run.error).toLowerCase()}`, null, "err"); }
    changed();
  }

  /** @param {string} p */
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

  /** The head's few words, its tone, and the light's. @param {string} p @returns {{ tone: string, words: string, cta?: boolean, at?: number, host?: string, url?: string }} */
  function summary(p) {
    const s = proj(p), r = s.run;
    const sc = s.editing && screen(p) === "setup" ? "live" : screen(p); // its settings open: the app still runs as it was
    switch (sc) {
      case "checking": return { tone: "", words: "Checking…" };
      case "check-failed": return { tone: "", words: "Couldn't check" };
      case "setup": case "pick": return { tone: "", words: "Not deployed", cta: true };
      case "needs": return { tone: "", words: "Not ready yet", cta: true };
      case "getting": { const g = s.check.getting || findThread(p) || s.asked, st = L.askState(p, g); return st.k === "work" ? { tone: "work", words: "Getting ready", at: g.since } : { tone: "", words: st.k === "done" ? "Ready to merge" : "Thread started" }; }
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

  Object.assign(L, { load, take, preflight, watch, event, screen, summary });
}
