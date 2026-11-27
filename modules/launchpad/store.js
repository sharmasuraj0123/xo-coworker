// @ts-check
import { appState } from "./model.js";
import { read, write } from "../../core/platform/storage.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { NODES, NEEDS_YOU, WORD, CACHE, AGAIN_MS, ERR_MS, AFTER, newRun, slug, failWords } from "./words.js";

export function launchpadCache() {
  /** @param {unknown} error */
  const report = (error) => {
    if (error instanceof SyntaxError || (error instanceof DOMException && ["SecurityError", "QuotaExceededError"].includes(error.name))) return;
    reportFailure(error);
  };
  const cached = read(CACHE, (raw) => {
    /** @type {unknown} */
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "string"));
  }, {}, "local", report);
  return {
    cached,
    /** @param {string} p @param {string} state */
    remember(p, state) {
      cached[p] = state;
      write(CACHE, JSON.stringify(cached), "local", report);
    },
  };
}

/** @import { DeployFrame, LaunchpadStoreOptions, LaunchpadProject } from "./lifetime-types.d.ts" */
/** @param {LaunchpadStoreOptions} records */
export function installStore({
  api, frame, proj, changed, land, announce, endStop, nameOf, findThread, tell, remember, windowBody, invalidate, stopped, visible, askState,
}) {
  /** @param {{seq?: number}} s */
  const ticket = (s) => (s.seq = (s.seq || 0) + 1);
  /** @param {{applied?: number}} s @param {number} n */
  const current = (s, n) => { if (n <= (s.applied || 0)) return false; s.applied = n; return true; };
  /** @param {{applied?: number}} s @param {number} n */
  const stale = (s, n) => n <= (s.applied || 0);
  /** @param {LaunchpadProject} s */
  const sayGitHub = (s) => { s.loud = false; s.ghErr = null; announce(s.check?.github?.workflow ? "GitHub has the workflow permission now." : "GitHub still doesn't have the workflow permission."); };
  /** @param {string} p @param {boolean} [force] */
  async function load(p, force = false) {
    const s = proj(p);
    if (s.loading || (!force && s.at && Date.now() - s.at < (s.err ? ERR_MS : AGAIN_MS))) return;
    s.loading = true; s.err = null;
    const n = ticket(s);
    try {
      let c = await api.check(p);
      if (s.pre && api.preflight) c = await api.preflight(p, s.form?.name);
      if (!current(s, n)) { s.loading = false; return; } // a newer answer is already here
      s.check = c; s.at = Date.now(); s.err = null;
      if (!s.form) s.form = { name: slug(c.name || p), port: c.port ? String(c.port) : "", repo: c.repo?.create || slug(p), env: {}, errs: {}, size: c.size || "", disk: !!c.storage, diskPath: c.storage?.path || "", diskGb: String(c.storage?.gb || 2) };
      if (c.running && !s.run && c.running !== s.ended) watch(p); // never the run Space just said was over
      remember(p, c.state);
    } catch (e) {
      if (stale(s, n)) { s.loading = false; changed(); return; }
      s.err = e; s.at = Date.now();
    }
    s.loading = false;
    changed();
  }

  /** @param {string} p @param {DeployFrame} e */
  function take(p, e) {
    const s = proj(p), r = s.run, at = e.at || Date.now(); // Space's own time, so a replayed run keeps its clocks
    if (!r) return;
    if (e.type === "run") { if (e.started) r.startedAt = e.started; return; }
    if (e.step === undefined) return;
    const st = r.steps[e.step] || (r.steps[e.step] = {});
    if (e.state === "doing" && st.state !== "doing") st.at = at;
    Object.assign(st, { state: e.state, text: e.text || st.text, url: e.url || st.url });
    if (e.ready != null) { st.ready = e.ready; st.of = e.of; }
    if (e.release) r.release = e.release;
    if (e.state === "done") st.took = at - (st.at || at);
    if (e.state === "failed") { st.took = at - (st.at || at); r.error = { text: e.text, code: "", ...e.error, node: e.step }; }
    if (e.step === "live" && e.state === "done") {
      r.live = { host: e.host, url: e.url, release: e.release, commit: e.commit, at };
      const check = s.check, was = check?.app;
      r.appId = e.app?.id || r.appId || was?.id || "";
      const env = (s.check?.env || []).map((x) => (r.sent?.includes(x.name) ? { ...x, set: true } : x));
      // its size and disk: what it had, else what this deploy made it with (preflight says Launchpad's own soon after)
      const made = r.made || {};
      if (check) s.check = { ...check, state: "linked", env, app: {
        id: r.appId, name: e.app?.name || was?.name, url: e.url, host: e.host || "", status: "live", release: e.release, at,
        commit: e.commit || was?.commit, size: was?.size || made.size || "", sizeLabel: was?.sizeLabel || "",
        storage: made.storage !== undefined ? made.storage : was?.storage,
      } };
    }
  }

  /** @param {string} p */
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
      else if (s.loud) { s.loud = false; s.ghErr = e instanceof Error ? e.message : "XO Space didn't answer"; announce(`Couldn't check GitHub: ${s.ghErr}.`); }
    }
    changed();
  }

  /** @param {string} p */
  function watch(p) {
    const s = proj(p);
    s.run = newRun();
    s.run.stop = api.watch(p, event.bind(null, p));
  }

  /** @param {string} p @param {DeployFrame} e */
  function event(p, e) {
    const s = proj(p), f = s.form;
    if (!s.run || !f) return;
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
      if (e.code === "name_taken") f.errs = { name: "Taken on Launchpad.", nameFix: e.data?.suggestion || "" };
      else if (e.code === "port_missing") f.errs = { port: "Which port does it listen on?" };
      else if (e.code === "repo_name_taken") { f.repo = e.data?.suggestion || f.repo; f.repoChosen = true; f.errs = { repo: "That name holds other code on your GitHub." }; }
      else if (e.code === "create_repo" && s.check) s.check = { ...s.check, repo: { ...s.check.repo, admin: false, why: e.data?.reason || s.check.repo.why } };
      else { if (e.code === "confirm_repo") f.useRepo = ""; if (e.code === "other_apps") f.allowApps = null; s.needs = e; } // confirm_repo, link_existing, app_missing: a decision, lit, above the form (a confirmed repo Space asks again about is no longer confirmed)
      land(f.errs.name ? '[data-lp-f="name"]' : f.errs.port ? '[data-lp-f="port"]' : f.errs.repo ? '[data-lp-f="repo"]' : '.lp-ask .lp-go, [data-lp="deploy"], [data-lp="reconnect"]');
      invalidate(); changed();
      if (f.errs.name || f.errs.port) frame(() => {
        const n = windowBody()?.querySelector(`[data-lp-f="${f.errs.name ? "name" : "port"}"]`);
        if (n instanceof HTMLElement) n.focus();
      });
      return;
    }
    if (e.state === "doing" || e.state === "done" || e.state === "failed") f.env = {}; // under way: the values have gone with the request
    // the stop we asked for, confirmed by the run itself
    if (e.state === "failed" && e.error?.code === "cancelled" && (s.run.stopSent || s.run.stopErr)) { stopped(p, s.run); return; }
    if (e.state === "failed" && e.error?.code === "size_not_allowed") {
      s.run = null; f.errs = { size: "Launchpad doesn't allow this size for this app. Pick another." }; invalidate(); land('[data-lp-f="size"]');
      announce("Launchpad doesn't allow that size for this app. Pick another."); changed();
      frame(() => { const n = windowBody()?.querySelector('[data-lp-f="size"]'); if (n instanceof HTMLElement) n.focus(); });
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
    if (e.state === "failed" && s.run.error) { announce(`${name} didn't deploy: ${failWords(s.run.error)}.`); if (!visible(p)) tell(`${name}: ${failWords(s.run.error).toLowerCase()}`, null, "err"); }
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

  /** @param {string} p @returns {{ tone: string, words: string, cta?: boolean, at?: number, host?: string, url?: string }} */
  function summary(p) {
    const s = proj(p), r = s.run;
    const sc = s.editing && screen(p) === "setup" ? "live" : screen(p); // its settings open: the app still runs as it was
    switch (sc) {
      case "checking": return { tone: "", words: "Checking…" };
      case "check-failed": return { tone: "", words: "Couldn't check" };
      case "setup": case "pick": return { tone: "", words: "Not deployed", cta: true };
      case "needs": return { tone: "", words: "Not ready yet", cta: true };
      case "getting": { const g = s.check?.getting || findThread(p) || s.asked, st = askState(p, g); return st === "work" ? { tone: "work", words: "Getting ready", at: g?.since ?? undefined } : { tone: "", words: st === "done" ? "Ready to merge" : "Thread started" }; }
      case "device": return { tone: "need", words: "Waiting for GitHub" };
      case "undo": return { tone: "work", words: "Starting" };
      case "lost": return { tone: "", words: "Lost touch" };
      case "run": { const on = NODES.find((n) => r?.steps[n]?.state === "doing") || "repo"; return { tone: "work", words: WORD[on], at: r?.startedAt }; }
      case "failed": return { tone: r?.error && NEEDS_YOU.has(r.error.code) ? "need" : "stop", words: r?.error ? failWords(r.error) : "Didn't deploy" };
      case "live": {
        const a = r?.live || s.check?.app, st = String(a && "status" in a ? a.status || "" : "");
        if (a && "gone" in a && a.gone) return { tone: "stop", words: "App not on Launchpad" };
        const [tone, words] = st ? appState(st) : ["go", "Live"]; // no status yet (before preflight): it was live when linked
        return { tone, words, host: a?.host, url: a?.url };
      }
      default: return { tone: "", words: "" };
    }
  }

  return { load, preflight, watch, event, screen, summary };
}
