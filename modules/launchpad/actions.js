// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { copyText, COPY_REFUSED } from "../../core/platform/index.js";
import { focusOpened } from "../../core/ui/a11y/keynav.js";
import { installConnections } from "./connections.js";
import { NEEDS_YOU, SLUG, STOP_MS, UNLINK_MS, AFTER, newRun } from "./words.js";

/** @import { DeployRun, LaunchpadRecords, LaunchpadForm, LaunchpadCheck } from "./lifetime-types.d.ts" */
/** @param {LaunchpadRecords & ReturnType<typeof import("./store.js").installStore> & {hide(): void}} records */
export function installActions(records) {
  const { api, frame, windowScope, proj, changed, land, announce, say, unsay, nameOf, projectOf, go, tell, windowBody, windowView, shownProject,
    invalidate, visible, load, preflight, watch, event, hide } = records;
  const { github, startPick, cancelPick, cancelDevice } = installConnections(records);
  /** @type {WeakMap<HTMLElement, () => void>} */
  const commandFeedback = new WeakMap();
  let clearCopy = () => {};
  /** @param {string} selector @param {FocusOptions} [options] */
  const focus = (selector, options) => frame(() => { const el = windowBody()?.querySelector(selector); if (el instanceof HTMLElement) el.focus(options); });
  /** @param {LaunchpadForm} f @param {LaunchpadCheck} c @param {boolean} editing */
  function validate(f, c, editing) {
    /** @type {Record<string, string>} */
    const errs = {};
    if (!SLUG.test(f.name)) errs.name = "Lowercase letters, digits and hyphens, up to 25.";
    const port = Number(f.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errs.port = "A port from 1 to 65535.";
    const gb = Number(f.diskGb), was = c.app?.storage;
    if (!editing && c?.sizes && f.size && !c.sizes.tiers.some((/** @type {{name: string}} */ t) => t.name === f.size)) errs.size = "Pick one of the sizes Launchpad offers.";
    if (!editing && f.disk) {
      if (!/^\/[^/]/.test(f.diskPath) || /(^|\/)\.\.(\/|$)/.test(f.diskPath)) errs.disk = "Where it's mounted: an absolute path other than /, like /data.";
      else if (!Number.isInteger(gb) || gb < 1 || gb > 20) errs.disk = "A size from 1 to 20 GB.";
    }
    if (editing && was?.gb != null && f.diskGb !== String(was.gb) && (!Number.isInteger(gb) || gb < was.gb || gb > 20)) errs.disk = gb < was.gb ? `It can't shrink: ${was.gb} GB or more, up to 20.` : `From ${was.gb} to 20 GB.`;
    f.errs = errs;
    return !Object.keys(errs).length;
  }

  /** @param {string} p */
  function deploy(p, again = false) {
    const s = proj(p), { check, form } = s;
    if (!check || !form) return;
    const gh = check.github, edit = !!(s.editing && check.app);
    again = again || edit;
    if (gh && !(gh.connected && gh.workflow)) { github(p); return; }
    if (!validate(form, check, edit)) {
      invalidate(); land('[aria-invalid="true"], .is-bad input, .is-bad xo-select'); changed();
      focus('[aria-invalid="true"], .is-bad input, .is-bad xo-select');
      return;
    }
    s.run = newRun(); s.run.undo = Date.now() + 3e3; s.run.edit = edit; s.editing = false;
    const t = setInterval(() => {
      if (!s.run || !s.run.undo) { clearInterval(t); return; }
      const left = s.run.undo - Date.now();
      const n = windowBody()?.querySelector(".lp-count");
      if (n) n.textContent = String(Math.max(1, Math.ceil(left / 1000)));
      if (left <= 0) { clearInterval(t); begin(p, again); }
    }, 200);
    land('[data-lp="undo"]'); changed();
    announce(`Deploying ${form.name} in 3 seconds. Undo to stop it.`);
    focus('[data-lp="undo"]', { preventScroll: true });
  }
  /** @param {string} p */
  function begin(p, again = false) {
    const s = proj(p), f = s.form, c = s.check;
    if (!f || !c || !s.run) return;
    const env = Object.fromEntries(Object.entries(f.env).filter(([, v]) => v !== ""));
    // a new app (or one made again): its size and disk; a linked app's settings: a larger disk, at the same path
    const creating = !c.app || f.recreate, was = c.app?.storage, gb = Number(f.diskGb);
    const machine = creating ? { ...(c.sizes && f.size ? { size: f.size } : {}), ...(f.disk ? { storage_path: f.diskPath, storage_size: gb } : {}) }
      : s.run.edit && was?.gb != null && gb > was.gb ? { storage_path: was.path, storage_size: gb } : {};
    s.run.made = creating ? { size: (c.sizes && (f.size || c.sizes.def)) || c.size || "", storage: f.disk ? { path: f.diskPath, gb } : null } : machine.storage_size && was ? { storage: { path: was.path, gb } } : {};
    s.sent = { again, recreate: !!f.recreate, edit: !!s.run.edit }; // what a decision's answer deploys again with
    const body = { name: f.name, port: Number(f.port), ...machine, ...(f.useRepo ? { use_repo: f.useRepo } : {}), ...(f.allowApps?.length ? { allow_apps: f.allowApps } : {}), ...(c.repo.admin ? {} : { create_repo: true, repo_name: f.repoChosen ? f.repo : f.name }), ...(c.app && again && !f.recreate && (s.run.edit || !c.behind) ? { rebuild: true } : {}), ...(f.recreate ? { recreate: true } : {}), env, sensitive: (c.env || []).filter((/** @type {{sensitive: boolean, name: string}} */ x) => x.sensitive).map((/** @type {{name: string}} */ x) => x.name) };
    s.run.undo = 0; s.run.startedAt = Date.now(); s.run.sent = Object.keys(env); // names only: what goes live with this release
    s.needs = null; s.warn = null; f.recreate = false; f.allowApps = null; // recreate and allow_apps are asked once, not for every deploy after
    s.run.stop = api.deploy(p, body, event.bind(null, p));
    if (shownProject() !== p) f.env = {}; // sent with the section put away: nothing here to keep them for
    land('[data-lp="stop"]'); // Undo's time is up: it goes, Stop takes its place
    changed();
  }
  /** @param {string} p @param {string} id */
  function link(p, id) {
    const s = proj(p);
    s.picking = null; s.linking = true; land('[data-lp="pick-cancel"]'); changed();
    api.link(p, id)
      .then((a) => { if (s.check) s.check = { ...s.check, state: "linked", app: a }; s.run = null; land('[data-lp="again"]'); load(p, true); })
      .catch((/** @type {Error} */ e) => { land('[data-lp="pick"]'); tell(`Couldn't link it: ${e.message}`, null, "err"); })
      .finally(() => { s.linking = false; changed(); });
  }

  /** @param {{live?: unknown, error?: unknown, ended?: boolean}} run */
  const runOver = (run) => !!(run.live || run.error || run.ended);
  /** @param {string} p @param {DeployRun} run */
  function stopNow(p, run) {
    const s = proj(p);
    if (s.run !== run || runOver(run)) { unsay(run.mid); return; }
    if (!api.stop || !run.mid) return;
    const mid = run.mid;
    run.stopSent = true; run.stopErr = null; changed();
    const name = s.form?.name || nameOf(p);
    // the window has ended and the stop is on its way: the same notice says so, with no Undo (it's no longer one)
    say(mid, { text: `Stopping the deploy of ${name}…`, sub: "Waiting for Space to confirm", kind: "halt" }, 30000);
    /** @param {string} why */
    const refused = (why) => {
      run.stopErr = why;
      announce(`Couldn't stop the deploy: ${why}. It's still running.`);
      // refused: the same notice says so, with Stop again (it works from there, whatever is on screen)
      say(mid, { text: `Couldn't stop the deploy of ${name}`, sub: `${why}. It's still deploying.`, kind: "err",
        undo: () => { fromNotice(p, '[data-lp="stop"]'); startStop(p); }, undoLabel: "Stop again" }, 6000);
      changed();
    };
    const late = () => { if (!run.ended) unsay(run.mid); changed(); };
    api.stop(p).then((/** @type {{stopped?: boolean}} */ r) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      if (r && r.stopped === true) { stopped(p, run); return; }
      if (r && r.stopped === false) { announce("Nothing was running to stop: the stream says how it ended."); say(mid, { text: "Nothing was running to stop", kind: "done" }, 4200); changed(); return; }
      refused("Space didn't confirm it");
    }, (/** @type {Error} */ e) => {
      run.stopSent = false;
      if (s.run !== run || runOver(run)) { late(); return; }
      refused((e && e.message) || "Space didn't answer");
    });
  }
  /** @param {string} p @param {DeployRun} run */
  function keep(p, run) {
    if (!run.stopping) return;
    clearTimeout(run.stopping); run.stopping = 0;
    unsay(run.mid); // taken back here (Keep deploying) or in the notice: the notice goes either way
    land('[data-lp="stop"]'); // Keep deploying goes; focus that was on it goes back to Stop
    announce("The deploy carries on.");
    changed();
  }
  /** @param {string} p */
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
      const n = windowBody()?.querySelector('.lp-q .lp-count');
      if (n && run.stopAt) n.textContent = String(Math.max(1, Math.ceil((run.stopAt - Date.now()) / 1000)));
    }, 200);
    // the notice lives a moment past its window; the window's end changes it in place before then
    say(run.mid, { text: `Stopping the deploy of ${s.form?.name || nameOf(p)}`, kind: "halt", until: run.stopAt,
      undo: () => { fromNotice(p, '[data-lp="stop-undo"]'); keep(p, run); } }, STOP_MS + 1000);
    land('[data-lp="stop-undo"]'); changed();
    announce(`Stopping the deploy in 3 seconds. Keep deploying to take it back.`);
  }
  /** @param {string} p @param {DeployRun} run */
  function stopped(p, run) {
    const s = proj(p);
    if (s.run !== run) return;
    run.ended = true;
    run.stop && run.stop.stop();
    s.run = null; s.pre = 0; land(AFTER);
    announce("Deploy stopped.");
    if (run.mid) say(run.mid, { text: `Deploy of ${s.form?.name || nameOf(p)} stopped`, kind: "done" }, 4200);
    load(p, true); changed();
  }

  /** @param {string} p @param {string} sel */
  function fromNotice(p, sel) {
    /** @param {Element | null | false} el */
    const reach = (el) => !!(el && el.getClientRects().length && !el.closest("[inert]"));
    /** @param {HTMLElement} el */
    const go = (el) => { el.focus({ preventScroll: true }); return true; };
    const n = visible(p) && windowBody()?.querySelector(sel);
    if (n && n instanceof HTMLElement && reach(n)) return go(n);
    const d = projectOf(windowView()) === p && [...document.querySelectorAll("[data-lp-open]")].find(reach);
    if (d && d instanceof HTMLElement) return go(d);
    const w = ["scroller", "home"].map((id) => document.getElementById(id)).find(reach);
    if (w) return go(w);
    return false;
  }

  /** @param {string} p @param {boolean} open @param {true | false | Pick<MouseEvent, "detail">} [focusIn] */
  function menu(p, open, focusIn = false) {
    const s = proj(p);
    if (s.menu === open) return;
    const inside = !open && !!windowBody()?.querySelector(".lp-mn")?.contains(document.activeElement);
    if (inside) land('[data-lp="menu"]'); // its item goes with it: focus back on More
    s.menu = open; changed();
    if (open && focusIn) frame(() => focusOpened(windowBody()?.querySelector('.lp-mn') ?? null, focusIn === true ? undefined : focusIn));
  }

  /** @param {string | undefined} text @param {string} what @param {() => void} mark @param {() => void} unmark */
  async function copied(text, what, mark, unmark) {
    const signal = windowScope()?.signal;
    const ok = await copyText(String(text || ""));
    if (signal?.aborted) return;
    if (!ok) { unmark && unmark(); changed(); announce(COPY_REFUSED); tell(COPY_REFUSED, null, "err"); return; }
    mark(); announce(`Copied ${what}.`); changed();
    clearCopy(); clearCopy = windowScope()?.timeout(changed, 1600) ?? (() => {});
  }

  /** @param {string | undefined} name @param {HTMLElement} el @param {Pick<MouseEvent, "detail">} [e] */
  function act(name, el, e) {
    const p = projectOf(windowView());
    if (!p) return;
    const s = proj(p), { form, check } = s;
    if (name === "recheck") { s.err = null; land(AFTER); load(p, true); changed(); return; }
    if (!form || !check) return;
    switch (name) {
      case "deploy": deploy(p); return;
      case "undo": if (s.run) { s.run = null; form.allowApps = null; land('[data-lp="deploy"], [data-lp="again"], [data-lp="recreate"]'); announce("Deploy undone. Nothing changed."); changed(); } return;
      case "hide": hide(); return;
      case "home": if (s.editing) { s.editing = false; form.env = {}; invalidate(); changed(); } return;
      case "stop": startStop(p); return;
      case "stop-undo": if (s.run) keep(p, s.run); return;
      case "cmd-copy": copied(el.dataset.v, "the command", () => {
        s.cmdCopied = Date.now() + 1500;
        // the setup form isn't redrawn under the person's fingers: its button shows the check itself
        if (!el.isConnected) return;
        el.innerHTML = ICON.check; el.title = "Copied";
        commandFeedback.get(el)?.();
        const cancel = windowScope()?.timeout(() => { if (el.isConnected) { el.innerHTML = ICON.copy; el.title = "Copy the command"; } }, 1500);
        if (cancel) commandFeedback.set(el, cancel);
      }, () => { s.cmdCopied = 0; commandFeedback.get(el)?.(); if (el.isConnected) { el.innerHTML = ICON.copy; el.title = "Copy the command"; } }); return;
      case "recheck-gh": {
        // one check at a time: pressed again while one is out, it joins that one (which then says how it went)
        s.loud = true; s.ghErr = null;
        if (s.pre === 1) return;
        land('[data-lp="recheck-gh"], [data-lp="deploy"], [data-lp="reconnect"]'); s.pre = 0; if (NEEDS_YOU.has(s.run?.error?.code || "")) s.run = null;
        announce("Checking GitHub again."); changed(); preflight(p); return;
      }
      case "rewatch": s.run = null; watch(p); land('[data-lp="stop"]'); changed(); return;
      case "settings": s.run = null; s.needs = null; invalidate(); land(form.errs?.size ? '[data-lp-f="size"]' : '[data-lp-f="name"]'); changed(); focus(form.errs.size ? '[data-lp-f="size"]' : '[data-lp-f="name"]'); return;
      case "machine-open": s.machine = true; invalidate(); land('[data-lp-f="size"]'); changed(); focus('[data-lp-f="size"]'); return;
      case "disk-add": form.disk = true; form.errs = { ...form.errs, disk: "" }; invalidate(); land('[data-lp-f="diskPath"]'); changed(); focus('[data-lp-f="diskPath"]'); return;
      case "disk-remove": form.disk = false; form.errs = { ...form.errs, disk: "" }; invalidate(); land('[data-lp="disk-add"]'); changed(); focus('[data-lp="disk-add"]'); return;
      case "use-repo": { // the repository Space asked about, confirmed: the same deploy again, with it named exactly
        const repo = s.needs?.data?.repo, was = s.sent;
        if (!repo) return;
        form.useRepo = repo; form.recreate = !!was?.recreate; s.editing = !!(was?.edit && check?.app);
        s.needs = null; s.run = null; deploy(p, !!was?.again); return;
      }
      case "allow-apps": { // the push Space asked about, allowed once: the same deploy again, with every app's id (any left out and Space asks again)
        const ids = (s.needs?.data?.apps || []).map((/** @type {{id: string}} */ a) => a.id).filter(Boolean), was = s.sent;
        if (!ids.length) return;
        form.allowApps = ids; form.recreate = !!was?.recreate; s.editing = !!(was?.edit && check?.app);
        s.needs = null; s.run = null; deploy(p, !!was?.again); return;
      }
      case "decline-apps": s.needs = null; form.allowApps = null; s.run = null; invalidate(); land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not pushing. Nothing changed."); changed(); return;
      case "decline-repo": s.needs = null; form.useRepo = ""; s.run = null; invalidate(); land('[data-lp="deploy"], [data-lp="reconnect"]'); announce("Not deploying to that repository. Nothing changed."); changed(); return;
      case "create-repo": s.check = { ...check, repo: { ...check.repo, admin: false } }; s.needs = null; s.run = null; deploy(p); return;
      case "link-same": { const id = s.needs?.data?.app?.id || s.run?.error?.app?.id; s.needs = null; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); if (id) api.link(p, id).then((a) => { s.check = { ...check, state: "linked", app: a }; deploy(p, true); }).catch((/** @type {Error} */ err) => tell(`Couldn't link it: ${err.message}`, null, "err")); changed(); return; }
      case "env-all": { // the first of the names it shows, by name (an index into the list could miss when they interleave)
        const first = (check.env || []).find((/** @type {{name: string, sensitive: boolean, default: string}} */ x) => !(x.sensitive || !x.default || form.env[x.name]));
        s.envAll = true; invalidate(); land(first ? `[data-lp-env="${CSS.escape(first.name)}"]` : ".lp-ev input"); changed(); return;
      }
      case "recreate": form.recreate = true; s.run = null; deploy(p, true); return;
      case "edit": s.editing = true; form.diskGb = String(check.app?.storage?.gb || ""); form.errs = {}; s.menu = false; invalidate(); land("[data-lp-f], .lp-ev input"); changed(); focus(".lp-ev input, [data-lp-f]"); return;
      case "edit-cancel": s.editing = false; form.env = {}; invalidate(); land('[data-lp="edit"]'); changed(); return;
      case "again": s.run = null; form.errs = {}; deploy(p, true); return; // the linked app, the same settings: 3 s, then it goes
      case "retry": s.run = null; deploy(p); return;
      case "copy": copied((s.run?.live || check.app)?.url, "the address", () => { s.copied = Date.now() + 1500; }, () => { s.copied = 0; }); return;
      case "menu": menu(p, !s.menu, !s.menu && (e || true)); return;
      case "unlink": {
        // Undo is real: Space unlinks (and commits deploy.json) only once its 3 s are up
        s.menu = false; s.needs = null;
        const was = check, run = s.run;
        s.check = { ...was, app: null, state: "ready" }; s.run = null; land('[data-lp="deploy"], [data-lp="reconnect"]'); changed();
        const mid = `lp-unlink:${p}`, until = Date.now() + UNLINK_MS;
        const t = setTimeout(() => {
          say(mid, { text: "Unlinked from Launchpad", kind: "done" }, 2400);
          api.unlink(p).then(() => load(p, true)).catch((/** @type {Error} */ e) => {
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
      case "pick-cancel": cancelPick(p); return;
      case "link": if (el.dataset.id) link(p, el.dataset.id); return;
      case "reconnect": github(p); return;
      case "code-copy": { const d = s.device; if (d) copied(d.code, "the code", () => { if (s.device === d) d.copiedUntil = Date.now() + 1500; }, () => { d.copiedUntil = 0; }); return; }
      case "device-cancel": cancelDevice(p); return;
      case "ask": case "ask-fix": {
        if (s.asking) return; // one thread per ask: a second click while Space answers starts nothing
        const note = name === "ask-fix" && el.dataset.issue ? `${el.dataset.issue} Fix the cause so it deploys.` : "";
        s.asking = true; s.askErr = null; changed();
        api.askAgent(p, note).then((/** @type {{thread_ts?: string, thread?: string, title?: string}} */ g) => { s.asking = false; s.asked = { thread: g.thread_ts || g.thread, title: g.title || "Deploy to Launchpad", since: Date.now() }; s.run = null; land('[data-lp="thread"]'); announce("A thread is getting it ready."); changed(); })
          .catch((/** @type {Error} */ err) => {
            s.asking = false; s.askErr = err?.message || "XO Space didn't answer";
            announce(`Couldn't start the thread: ${s.askErr}.`); changed();
            focus(`[data-lp="${name}"]`, { preventScroll: true });
          });
        return;
      }
      // the thread takes the place of what's shown, and focus goes to it: go() closes the window and places it
      case "thread": if (el.dataset.go) go?.(el.dataset.go); return;
      case "fix-port": if (s.run?.error?.declared) { form.port = String(s.run.error.declared); s.run = null; deploy(p); } return;
      case "use-name": form.name = el.dataset.v ?? ""; form.errs = {}; invalidate(); land('[data-lp-f="name"]'); changed(); return;
    }
  }

  return { act, menu, stopped };
}
