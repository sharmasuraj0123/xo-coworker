// @ts-check

// What you do in the section: deploy with its Undo, Stop with its window, link, unlink, GitHub's device flow, Ask an agent.
import { ICON } from "../../core/ui/icons/names.js";
import { copyText, COPY_REFUSED } from "../../core/platform/index.js";
import { NEEDS_YOU, SLUG, STOP_MS, UNLINK_MS, AFTER, newRun } from "./words.js";

/** Adds the actions to the section's shared state L. @param {any} L */
export function installActions(L) {
  const { api, S, proj, changed, land, announce, say, unsay, nameOf, projectOf, go, notify } = L;
  const { load, preflight, watch, event } = L;
  /** @param {string} p */
  function validate(p) {
    const s = proj(p), f = s.form, c = s.check, errs = {};
    if (!SLUG.test(f.name)) errs.name = "Lowercase letters, digits and hyphens, up to 25.";
    const port = Number(f.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errs.port = "A port from 1 to 65535.";
    const editing = !!(s.editing && c?.app), gb = Number(f.diskGb), was = c?.app?.storage;
    if (!editing && c?.sizes && f.size && !c.sizes.tiers.some((/** @type {any} */ t) => t.name === f.size)) errs.size = "Pick one of the sizes Launchpad offers.";
    if (!editing && f.disk) {
      if (!/^\/[^/]/.test(f.diskPath) || /(^|\/)\.\.(\/|$)/.test(f.diskPath)) errs.disk = "Where it's mounted: an absolute path other than /, like /data.";
      else if (!Number.isInteger(gb) || gb < 1 || gb > 20) errs.disk = "A size from 1 to 20 GB.";
    }
    if (editing && was && f.diskGb !== String(was.gb) && (!Number.isInteger(gb) || gb < was.gb || gb > 20)) errs.disk = gb < was.gb ? `It can't shrink: ${was.gb} GB or more, up to 20.` : `From ${was.gb} to 20 GB.`;
    f.errs = errs;
    return !Object.keys(errs).length;
  }

  /** @param {string} p */
  function deploy(p, again = false) {
    const s = proj(p), gh = s.check?.github;
    // the app's settings (Change): always a build with them; Space builds main as it is, the live commit again or main's newer commits
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
  /** @param {string} p */
  function begin(p, again = false) {
    const s = proj(p), f = s.form, c = s.check;
    const env = Object.fromEntries(Object.entries(f.env).filter(([, v]) => v !== ""));
    // a new app (or one made again): its size and disk; a linked app's settings: a larger disk, at the same path
    const creating = !c.app || f.recreate, was = c.app?.storage, gb = Number(f.diskGb);
    const machine = creating ? { ...(c.sizes && f.size ? { size: f.size } : {}), ...(f.disk ? { storage_path: f.diskPath, storage_size: gb } : {}) }
      : s.run.edit && was && gb > was.gb ? { storage_path: was.path, storage_size: gb } : {};
    s.run.made = creating ? { size: (c.sizes && (f.size || c.sizes.def)) || c.size || "", storage: f.disk ? { path: f.diskPath, gb } : null } : machine.storage_size ? { storage: { path: was.path, gb } } : {};
    s.sent = { again, recreate: !!f.recreate, edit: !!s.run.edit }; // what a decision's answer deploys again with
    const body = { name: f.name, port: Number(f.port), ...machine, ...(f.useRepo ? { use_repo: f.useRepo } : {}), ...(f.allowApps?.length ? { allow_apps: f.allowApps } : {}), ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.repoChosen ? f.repo : f.name }), ...(c.app && again && !f.recreate && (s.run.edit || !c.behind) ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((/** @type {any} */ x) => x.sensitive).map((/** @type {any} */ x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now(); s.run.sent = Object.keys(env); // names only: what goes live with this release
    s.needs = null; s.warn = null; f.recreate = false; f.allowApps = null; // recreate and allow_apps are asked once, not for every deploy after
    s.run.stop = api.deploy(p, body, (/** @type {any} */ e) => event(p, e));
    if (S.shown !== p) f.env = {}; // sent with the section put away: nothing here to keep them for
    land('[data-lp="stop"]'); // Undo's time is up: it goes, Stop takes its place
    changed();
  }
  /** @param {string} p */
  const visible = (p) => S.el && !S.el.classList.contains("is-folded") && !S.el.hidden && S.v && projectOf(S.v) === p && document.body.classList.contains("stage-open");

  /** Reconnect GitHub with the workflow scope: Space's device flow, polled until it's granted. @param {string} p */
  async function github(p) {
    const s = proj(p);
    // this call owns one code: after a Cancel or a newer Reconnect its late answers change nothing (Astra: an old poll cleared a newer code)
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
    } catch (e) { if (!ours()) return; s.device = null; land('[data-lp="reconnect"]'); notify && notify(`GitHub didn't connect: ${/** @type {any} */ (e).message}`, null, "err"); changed(); }
  }

  /** @param {string} p */
  async function startPick(p) {
    const s = proj(p);
    s.picking = { apps: null };
    land('[data-lp="pick-cancel"]'); // Back, while it reads; the list arrives under it
    changed();
    try { const apps = await api.apps(p); if (s.picking) s.picking.apps = apps; } // Back meanwhile: nothing to fill
    catch (e) { s.picking = null; land('[data-lp="pick"]'); notify && notify(`Couldn't read your Launchpad apps: ${/** @type {any} */ (e).message}`, null, "err"); }
    changed();
  }

  /** Link an app on Launchpad, then read the project afresh: preflight builds on the last check, which doesn't know the link yet. @param {string} p @param {string} id */
  function link(p, id) {
    const s = proj(p);
    s.picking = null; s.linking = true; land('[data-lp="pick-cancel"]'); changed();
    api.link(p, id)
      .then((/** @type {any} */ a) => { s.check = { ...s.check, state: "linked", app: a }; s.run = null; land('[data-lp="again"]'); load(p, true); })
      .catch((/** @type {any} */ e) => { land('[data-lp="pick"]'); notify && notify(`Couldn't link it: ${e.message}`, null, "err"); })
      .finally(() => { s.linking = false; changed(); });
  }

  /** The run reached its end on the stream (live, failed, or stopped): that is what it did, whatever a stop request answers later. @param {any} run */
  const runOver = (run) => !!(run.live || run.error || run.ended);
  /** Ask Space to stop the run and say it stopped only on Space's receipt ({stopped: true}, or the stream's `error cancelled`); refused, Stop is there again. @param {string} p @param {any} run */
  function stopNow(p, run) {
    const s = proj(p);
    if (s.run !== run || runOver(run)) { unsay(run.mid); return; }
    if (!api.stop) return;
    run.stopSent = true; run.stopErr = null; changed();
    const name = s.form?.name || nameOf(p);
    // the window has ended and the stop is on its way: the same notice says so, with no Undo (it's no longer one)
    say(run.mid, { text: `Stopping the deploy of ${name}…`, sub: "Waiting for Space to confirm", kind: "halt" }, 30000);
    /** Only an explicit receipt says it stopped ({stopped: true}, or the stream's own `error cancelled`); this is a refusal, said in place. @param {string} why */
    const refused = (why) => {
      run.stopErr = why;
      announce(`Couldn't stop the deploy: ${why}. It's still running.`);
      // refused: the same notice says so, with Stop again (it works from there, whatever is on screen)
      say(run.mid, { text: `Couldn't stop the deploy of ${name}`, sub: `${why}. It's still deploying.`, kind: "err",
        undo: () => { fromNotice(p, '[data-lp="stop"]'); startStop(p); }, undoLabel: "Stop again" }, 6000);
      changed();
    };
    // the answer lands after the run ended: a stream's cancelled already said the outcome in this notice; any other end, the waiting goes
    const late = () => { if (!run.ended) unsay(run.mid); changed(); };
    api.stop(p).then((/** @type {any} */ r) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      if (r && r.stopped === true) { stopped(p, run); return; }
      if (r && r.stopped === false) { announce("Nothing was running to stop: the stream says how it ended."); say(run.mid, { text: "Nothing was running to stop", kind: "done" }, 4200); changed(); return; }
      refused("Space didn't confirm it");
    }, (/** @type {any} */ e) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      refused((e && e.message) || "Space didn't answer");
    });
  }
  /** The stop taken back within its 3 s: nothing was sent; Stop is there again, focused where Keep deploying was. @param {string} p @param {any} run */
  function keep(p, run) {
    if (!run.stopping) return;
    clearTimeout(run.stopping); run.stopping = 0;
    unsay(run.mid); // taken back here (Keep deploying) or in the notice: the notice goes either way
    land('[data-lp="stop"]'); // Keep deploying goes; focus that was on it goes back to Stop
    announce("The deploy carries on.");
    changed();
  }
  /** Stop for p's run (here, or from its notice's Stop again): Undo for 3 s, then the stop is asked for; one notice (mid), changed in place throughout. @param {string} p */
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
  /** The stop is confirmed: the run is over; the project as it now is. @param {string} p @param {any} run */
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

  /** After a notice's Undo, or Hide, focus moves onto what reaches p's section and a person can reach: sel in it, its fold, p's Deploy, the page's work, the panel's Close. @param {string} p @param {string | null} sel */
  function fromNotice(p, sel) {
    const covered = document.body.classList.contains("stage-open") && matchMedia("(max-width: 760px)").matches;
    /** @param {any} el */
    const reach = (el) => !!(el && el.getClientRects().length && !el.closest("[inert]") && !(covered && !el.closest("#stage")));
    /** @param {any} el */
    const go = (el) => { el.focus({ preventScroll: true }); return true; };
    const n = sel && visible(p) && S.body.querySelector(sel);
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

  /** The ⋯ menu: opens with focus on its first item; closes back onto More (when focus was in it). @param {string} p @param {any} open */
  function menu(p, open, focusIn = false) {
    const s = proj(p);
    if (s.menu === open) return;
    const inside = !open && !!S.body?.querySelector(".lp-mn")?.contains(document.activeElement);
    if (inside) land('[data-lp="menu"]'); // its item goes with it: focus back on More
    s.menu = open; changed();
    if (open && focusIn) requestAnimationFrame(() => S.body?.querySelector('.lp-mn [role="menuitem"]')?.focus({ preventScroll: true }));
  }

  /** "Copied" only once the text is on the clipboard, for 1.5 s from that copy; refused, it says why and unmark() takes back an earlier "Copied". @param {any} text @param {string} what @param {any} mark @param {any} unmark */
  async function copied(text, what, mark, unmark) {
    const ok = await copyText(String(text || ""));
    if (!ok) { unmark && unmark(); changed(); announce(COPY_REFUSED); notify && notify(COPY_REFUSED, null, "err"); return; }
    mark(); announce(`Copied ${what}.`); changed();
    clearTimeout(S.copiedT); S.copiedT = setTimeout(changed, 1600); // the latest Copy's 1.5 s, not the first's
  }

  /** @param {string} name @param {any} el */
  function act(name, el) {
    const p = projectOf(S.v);
    if (!p) return;
    const s = proj(p);
    switch (name) {
      case "open": L.onOpen && L.onOpen(); return;
      case "deploy": deploy(p); return;
      case "undo": if (s.run) { s.run = null; s.form.allowApps = null; land('[data-lp="deploy"], [data-lp="again"], [data-lp="recreate"]'); announce("Deploy undone. Nothing changed."); changed(); } return;
      case "hide": { const here = S.body?.contains(document.activeElement); L.onHide && L.onHide(); if (here) fromNotice(p, null); return; } // put away: focus on what opens it again
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
        const ids = (s.needs?.data?.apps || []).map((/** @type {any} */ a) => a.id).filter(Boolean), was = s.sent || {};
        if (!ids.length) return;
        s.form.allowApps = ids; s.form.recreate = !!was.recreate; s.editing = !!(was.edit && s.check?.app);
        s.needs = null; s.run = null; deploy(p, !!was.again); return;
      }
      case "decline-apps": s.needs = null; s.form.allowApps = null; s.run = null; S.key = ""; land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not pushing. Nothing changed."); changed(); return;
      case "decline-repo": s.needs = null; s.form.useRepo = ""; s.run = null; S.key = ""; land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not deploying to that repository. Nothing changed."); changed(); return;
      case "create-repo": s.check = { ...s.check, repo: { ...s.check.repo, admin: false } }; s.needs = null; s.run = null; deploy(p); return;
      case "link-same": { const id = s.needs?.data?.app?.id || s.run?.error?.app?.id; s.needs = null; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); if (id) api.link(p, id).then((/** @type {any} */ a) => { s.check = { ...s.check, state: "linked", app: a }; deploy(p, true); }).catch((/** @type {any} */ err) => notify && notify(`Couldn't link it: ${err.message}`, null, "err")); changed(); return; }
      case "env-all": { // the first of the names it shows, by name (an index into the list could miss when they interleave)
        const f = s.form, first = (s.check.env || []).find((/** @type {any} */ x) => !(x.sensitive || !x.default || f.env[x.name]));
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
        // one notice for this unlink, its Undo as long as the unlink waits; refused or undone, the app is back and focus with it on More
        const mid = `lp-unlink:${p}`, until = Date.now() + UNLINK_MS;
        const t = setTimeout(() => {
          say(mid, { text: "Unlinked from Launchpad", kind: "done" }, 2400);
          api.unlink(p).then(() => load(p, true)).catch((/** @type {any} */ e) => {
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
        api.askAgent(p, note).then((/** @type {any} */ g) => { s.asking = false; s.asked = { thread: g.thread_ts || g.thread, title: g.title || "Deploy to Launchpad", since: Date.now() }; s.run = null; land('[data-lp="thread"]'); announce("A thread is getting it ready."); changed(); })
          .catch((/** @type {any} */ err) => {
            s.asking = false; s.askErr = err?.message || "XO Space didn't answer";
            announce(`Couldn't start the thread: ${s.askErr}.`); changed();
            requestAnimationFrame(() => S.body?.querySelector(`[data-lp="${name}"]`)?.focus({ preventScroll: true }));
          });
        return;
      }
      // the thread takes the place of what's shown, and focus goes to it: go() places it (on a phone, the panel goes first)
      case "thread": go && go(el.dataset.go); return;
      case "fix-port": s.form.port = String(s.run.error.declared); s.run = null; deploy(p); return;
      case "use-name": s.form.name = el.dataset.v; s.form.errs = {}; S.key = ""; land('[data-lp-f="name"]'); changed(); return;
      case "recheck": s.err = null; land(AFTER); load(p, true); changed(); return; // Checking… has nothing to press: the section holds focus
    }
  }

  Object.assign(L, { act, menu, stopped, visible });
}
