// @ts-check

import { esc, RM, copyText, COPY_REFUSED } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { requireHtml, findHtml } from "../../core/platform/dom.js";
import { api } from "../../core/platform/api.js";
import { fmtSize } from "../../core/services/media/attachment-rules.js";
import { redraw } from "../../core/ui/redraw.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { ApiError } from "../../core/platform/http.js";
import { reportFailure } from "../../core/platform/util.js";
import { parseRepo, projectFailure, slugify } from "./project-input.js";
import { cloneError } from "./clone-notice.js";

/** @import { CloneActivity, CloneNotice, CloneStatus, GitHubState, WorkspaceConfig } from "./read-types.d.ts" */

const PHASE = /** @type {Record<string, string>} */ ({ counting: "Counting files in", receiving: "Downloading", resolving: "Unpacking", checkout: "Checking out", finishing: "Adding plan and memory to" });

const GH = ICON.github;

/** @param {unknown} failure */
function canRetryClone(failure) {
  return failure instanceof ApiError && (
    failure.code === "network" || failure.code === "timeout" || [429, 502, 503, 504].includes(failure.status)
  );
}

/** @param {import("./types").CreateCtx} ctx @param {import("./types").CreateScope} scope */
export function initCreate(ctx, scope) {
  const { signal } = scope;
  const dlg = requireHtml("#create-dlg", "dialog"), form = requireHtml("#create-form", "form");
  const name = requireHtml("#cp-name", "input"), desc = requireHtml("#cp-desc", "textarea");
  const repo = requireHtml("#cp-repo", "input"), submit = requireHtml("#cp-submit", "button");
  const cancel = requireHtml("#cp-cancel", "button");
  let root = /** @type {string | null} */ (null), mode = "empty", nameTouched = false;
  let busy = /** @type {CloneActivity | null} */ (null);
  let gh = /** @type {GitHubState} */ ({ status: "unknown" });
  let stopLogin = /** @type {(() => void) | undefined} */ (undefined);

  requireHtml("#dlg-ic").innerHTML = ICON.project;
  requireHtml("#cpm-empty").innerHTML = ICON.plus;
  requireHtml("#cpm-clone").innerHTML = GH;

  const error = (/** @type {string} */ text, /** @type {{ id: string, label: string } | null | undefined} */ action = undefined) => {
    const el = requireHtml("#cp-err");
    el.innerHTML = text ? `${esc(text)}${action ? ` <button type="button" class="cp-link" data-cp="${action.id}">${esc(action.label)}</button>` : ""}` : "";
    el.hidden = !text;
  };
  const home = () => (root ? root.replace(/^\/home\/[^/]+/, "~") : "your projects folder");

  function renderWhere() {
    const id = slugify(name.value);
    requireHtml("#cp-where").innerHTML = `${ICON.folder}<span>${id ? `Saved as <code>${esc(home())}/${esc(id)}</code>` : `Saved in <code>${esc(home())}</code>`}</span>`;
  }
  function renderRepoIcon() {
    const r = parseRepo(repo.value);
    requireHtml("#cp-repo-ic").innerHTML = !r || r.github ? GH : ICON.branch;
  }
  function renderGh() {
    const el = requireHtml("#cp-gh"), r = parseRepo(repo.value), off = busy ? " disabled" : ""; // no new login mid-clone
    // in place: Connect becomes "Connecting…" and then Try again as the same button, so it keeps focus
    const put = (/** @type {string} */ html) => redraw(el, html);
    delete el.dataset.tone;
    if (r && !r.github) { put(`${ICON.key}<span>Cloned with this server's own Git access.</span>`); return; }
    if (gh.status === "connected") { put(`${ICON.check}<span>Connected as <b>@${esc(gh.username || "you")}</b>. Private repos work too.</span>`); el.dataset.tone = "ok"; return; }
    if (gh.status === "unknown") { put(`<i class="spin" aria-hidden="true"></i><span>Checking GitHub…</span>`); return; }
    if (gh.status === "starting") { put(`${ICON.lock}<span><button type="button" class="cp-link" data-cp="connect" aria-busy="true" aria-disabled="true">Connecting GitHub…</button></span>`); return; }
    if (gh.status === "code") {
      put(`${ICON.key}<span>Enter <b class="cp-code">${esc(gh.code)}</b> on GitHub. <a class="cp-link" href="${esc(gh.uri)}" target="_blank" rel="noopener" data-cp="copy">Copy code and open GitHub</a></span>`);
      return;
    }
    if (gh.status === "failed") { put(`${ICON.lock}<span>${esc(gh.error || "GitHub didn't connect.")} <button type="button" class="cp-link" data-cp="connect"${off}>Try again</button></span>`); return; }
    put(`${ICON.lock}<span><button type="button" class="cp-link" data-cp="connect"${off}>Connect GitHub</button> to clone private repos.</span>`);
  }

  async function readGh() {
    /** @type {GitHubState} */
    let next;
    try { next = await api.githubStatus({ signal }); } catch { next = { status: "needs_auth" }; }
    if (signal.aborted) return;
    gh = next.status === "connected" ? next : { status: "needs_auth" };
    renderGh();
  }
  /** GitHub's device flow, in place; a code keeps being polled with the dialog closed, since Space allows one login at a time. */
  async function connect() {
    if (gh.status === "starting") return;
    stopLogin?.();
    gh = { status: "starting" }; renderGh();
    // Connect lives in GitHub's line (#cp-gh) and in a failed clone's message (#cp-err): focus on either is focus on Connect
    const onConnect = () => {
      const a = document.activeElement;
      return !!a && (requireHtml("#cp-gh").contains(a) || requireHtml("#cp-err").contains(a));
    };
    const settle = (/** @type {GitHubState} */ next) => {
      if (signal.aborted) return;
      const was = onConnect();
      gh = next;
      renderGh();
      if (gh.status === "connected") { error(""); ctx.announce(`GitHub connected as ${gh.username}${gh.imported ? ", from this machine's gh login" : ""}.`); }
      if (!was) return;
      // where Connect leads: on failure a Connect again, for a code its Copy, once connected the repository
      const a = document.activeElement, still = a && a.isConnected && a.matches?.('[data-cp="connect"]');
      if (gh.status === "failed") { if (!still) findHtml("#cp-gh [data-cp=connect]")?.focus({ preventScroll: true }); }
      else (gh.status === "code" ? findHtml("#cp-gh [data-cp=copy]") : repo)?.focus({ preventScroll: true });
    };
    /** @type {import("../../core/platform/github-auth-types").Start} */
    let s;
    try { s = await api.githubConnect(); }
    catch (failure) { settle({ status: "failed", error: projectFailure(failure).message }); return; }
    if (signal.aborted) return;
    if (s.status === "connected") { settle(s); return; }
    const was = onConnect();
    gh = { status: "code", code: s.user_code, uri: s.verification_uri, session: s.session_id };
    renderGh();
    if (was) findHtml("#cp-gh [data-cp=copy]")?.focus({ preventScroll: true });
    const poll = async () => {
      let r = /** @type {GitHubState} */ ({ status: "failed" });
      // Space's 502 carries its words in a field ApiError doesn't read; 404 is a code that expired
      try { r = await api.githubConnectPoll(s.session_id, { signal }); }
      catch (failure) { r.error = failure instanceof ApiError && failure.status === 404 ? "That code expired." : ""; }
      if (signal.aborted || gh.session !== s.session_id) return;
      if (r.status === "pending") { stopLogin = scope.timeout(poll, 5000); return; }
      settle(r.status === "connected" ? r : { status: "failed", error: r.error });
    };
    stopLogin = scope.timeout(poll, 5000);
  }

  function setMode(/** @type {string} */ m, { focus = true } = {}) {
    mode = m;
    for (const b of requireHtml("#cp-mode").querySelectorAll("button")) {
      b.setAttribute("aria-checked", String(b.dataset.mode === m));
      b.tabIndex = b.dataset.mode === m ? 0 : -1;
    }
    requireHtml("#cp-repo-f", "label").hidden = m !== "clone";
    dlg.dataset.mode = m;
    if (!busy) submit.textContent = m === "clone" ? "Clone project" : "Create project";
    error("");
    if (m === "clone") { renderRepoIcon(); renderGh(); if (gh.status === "unknown") readGh(); }
    if (focus) (m === "clone" ? repo : name).focus();
  }

  /** busy: {t0, label, cloneId?, st?} while creating or cloning. @param {boolean} on @param {import("./types").Repo | null} [repoOf] */
  function setBusy(on, repoOf) {
    busy?.stopTick?.();
    busy = on ? { t0: Date.now(), label: repoOf?.label, host: repoOf && (repoOf.github ? "GitHub" : repoOf.label.split(/[/:]/)[0]) } : null;
    for (const el of [name, desc, repo]) el.disabled = on;
    for (const b of requireHtml("#cp-mode").querySelectorAll("button")) b.disabled = on;
    // aria-disabled="true", not disabled: a pressed Create keeps focus while it works, and a failure leaves it there
    if (on) { submit.setAttribute("aria-disabled", "true"); submit.setAttribute("aria-busy", "true"); } else { submit.removeAttribute("aria-disabled"); submit.removeAttribute("aria-busy"); }
    submit.innerHTML = on ? `<i class="spin" aria-hidden="true"></i>${mode === "clone" ? "Cloning…" : "Creating…"}` : (mode === "clone" ? "Clone project" : "Create project");
    // a create on its way can't be called back (a clone has its own Stop): the button only closes the dialog, and says so
    cancel.textContent = on ? "Close" : "Cancel";
    // the progress row goes when the work ends, however it ends: focus that was in it lands on Create before it hides
    const fromProg = !on && requireHtml("#cp-prog").contains(document.activeElement);
    requireHtml("#cp-prog").hidden = !(on && mode === "clone");
    if (fromProg) submit.focus({ preventScroll: true });
    delete requireHtml("#cp-phase").dataset.v;
    const stopButton = requireHtml("#cp-stop", "button");
    stopButton.disabled = false;
    stopButton.removeAttribute("aria-disabled");
    stopButton.removeAttribute("aria-busy");
    if (mode === "clone") renderGh();
    if (on && mode === "clone") tick();
  }
  /** The cloning row: phase, progress and time; its nodes stay put so Stop keeps focus, and only a new phase is announced. */
  function tick() {
    if (!busy) return;
    const s = Math.floor((Date.now() - busy.t0) / 1000), st = busy.st || { state: "pending" };
    // 0 % is "not started yet" (a big repo can count for a while on GitHub's side): the bar keeps moving until it has a real figure
    const pct = st.percent && st.percent > 0 ? Math.min(100, Math.round(st.percent)) : null;
    const bytes = st.received_bytes ?? 0;
    const bar = requireHtml("#cp-bar");
    const facts = [pct != null && pct > 0 && `${pct}%`, bytes > 0 && fmtSize(bytes)].filter(Boolean).join(" · ");
    bar.classList.toggle("is-known", pct != null);
    requireHtml(":scope > :first-child", undefined, bar).style.width = pct != null ? `${pct}%` : "";
    if (pct != null) { bar.setAttribute("aria-valuenow", String(pct)); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100"); bar.setAttribute("aria-valuetext", facts || `${pct}%`); }
    else for (const k of ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]) bar.removeAttribute(k);
    // Space's idle_seconds (when it sends it): git has said nothing for that long, so say who we're waiting on
    const quiet = (st.idle_seconds ?? 0) >= 8 ? busy.host : "";
    const verb = quiet && st.phase === "counting" ? `Waiting for ${quiet} to prepare` : PHASE[st.phase ?? ""] || "Cloning";
    const phase = `${verb} ${busy.label}`;
    const phaseLine = requireHtml("#cp-phase");
    if (phaseLine.dataset.v !== phase) {
      phaseLine.dataset.v = phase;
      phaseLine.innerHTML = `${esc(verb)} <b>${esc(busy.label)}</b>`;
    }
    requireHtml("#cp-facts").textContent = [facts, quiet && st.phase !== "counting" && `waiting for ${quiet}`].filter(Boolean).join(" · ");
    requireHtml("#cp-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    requireHtml("#cp-stop", "button").hidden = !busy.cloneId;
    requireHtml("#cp-hint").hidden = s < 6;
    busy.stopTick = scope.timeout(tick, 1000 - ((Date.now() - busy.t0) % 1000));
  }
  /** Follow a clone until it's done; throws its error, or "cancelled" once it's stopped from anywhere. @param {string} cloneId */
  async function follow(cloneId) {
    const job = busy;
    if (!job) throw new Error("No clone is being followed.");
    job.cloneId = cloneId;
    for (;;) {
      signal.throwIfAborted();
      await new Promise((resolve) => {
        const finish = scope.effect(() => () => resolve(undefined));
        scope.timeout(finish, 1000);
      });
      signal.throwIfAborted();
      /** @type {CloneStatus} */
      let st;
      try { st = await api.cloneStatus(cloneId, { signal }); }
      catch (failure) {
        if (signal.aborted || !canRetryClone(failure)) throw failure;
        continue;
      }
      signal.throwIfAborted();
      job.st = st;
      if (st.state === "done") return st;
      if (st.state === "failed") {
        throw new ApiError(502, st.error?.code || "clone_failed", st.error?.message || "The clone failed.", { detail: st.error?.detail });
      }
      if (st.state === "cancelled") throw Object.assign(new Error("stopped"), { code: "cancelled" });
    }
  }
  async function stop() {
    const id = busy?.cloneId;
    const st = requireHtml("#cp-stop", "button");
    if (!id || st.getAttribute("aria-busy") === "true") return;
    // aria-disabled while it asks, not disabled: a refused stop leaves you on Stop to try again
    st.setAttribute("aria-disabled", "true"); st.setAttribute("aria-busy", "true");
    // following the clone shows how it ended: stopped, or done or failed when Stop came too late
    try { await api.cancelClone(id); } catch (failure) {
      // the answer is this clone's: a refusal for an ended clone says nothing to a newer one's Stop
      if (signal.aborted || busy?.cloneId !== id) return;
      const err = projectFailure(failure);
      if (err.code === "clone_finished" || err.status === 404) return;
      st.removeAttribute("aria-disabled"); st.removeAttribute("aria-busy");
      error(`Couldn't stop it: ${err.message}`);
    }
  }


  let opener = /** @type {HTMLElement | null} */ (null);
  async function open() {
    if (signal.aborted) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && a !== document.body && !dlg.contains(a)) opener = a;
    ctx.setDrawer(false);
    if (busy) { dlg.showModal(); return; } // a clone still running: show it again as it is
    form.reset();
    if (gh.status !== "code") gh = { status: "unknown" }; // read GitHub again: it may have been connected (or dropped) elsewhere
    nameTouched = false;
    setBusy(false);
    setMode(mode, { focus: false });
    renderWhere();
    dlg.showModal();
    (mode === "clone" ? repo : name).focus();
    loadRoot();
  }
  /** Where projects live, read once; a submit that comes first waits for it. @type {Promise<string | null> | null} */
  let rootP = null;
  function loadRoot() {
    if (root) return Promise.resolve(root);
    return (rootP ||= api.workspaceConfig({ signal }).then((/** @type {WorkspaceConfig} */ cfg) => {
      if (signal.aborted) return null;
      root = cfg.roots?.[cfg.default] || null;
      renderWhere();
      return root;
    }, (failure) => {
      if (signal.aborted) return null;
      rootP = null;
      error(`Can't read where projects live: ${projectFailure(failure).message}`);
      return null;
    }));
  }
  /** Close, back to what opened it (or the phone menu); now: no closing animation, so the place opened next can take focus. */
  function close({ now = false, restore = true } = {}) {
    if (!dlg.open) return;
    const back = opener; opener = null;
    const land = () => {
      if (!restore) return;
      if (back && usable(back)) back.focus({ preventScroll: true });
      else ctx.onPhoneClose();
    };
    if (now || RM.matches) { dlg.close(); land(); return; }
    dlg.classList.add("is-closing");
    scope.timeout(() => { dlg.classList.remove("is-closing"); dlg.close(); land(); }, 160);
  }

  /** @param {string} id @param {string} title @param {string} description @param {string} line @param {string | null} [warning] */
  async function done(id, title, description, line, warning) {
    if (signal.aborted) return;
    await ctx.world.act.refresh().catch((failure) => { if (!signal.aborted) reportFailure(failure); });
    if (signal.aborted) return;
    ctx.welcome(id, description, `${title} ${line}${description ? ` · ${description.replace(/[.\s]+$/, "")}` : ""}`);
    const shown = dlg.open;
    setBusy(false);
    if (shown) { close({ now: true, restore: false }); ctx.go("p:" + id, { focus: true }); }
    // Taken there already: the project's own first line says it's ready, so only a warning needs the herald
    if (!shown || warning) ctx.heraldShow({ kind: "ready", text: `${title} is ready`, sub: warning || `${root}/${id}`, ...(shown ? {} : { open: "p:" + id }) }, 5200);
    ctx.announce(`${title} is ready.`);
  }

  let checking = false;
  async function submitForm() {
    if (busy || checking) return;
    checking = true;
    try { await check(); } finally { checking = false; }
  }
  async function check() {
    const title = name.value.trim(), id = slugify(title), description = desc.value.trim();
    const r = mode === "clone" ? parseRepo(repo.value) : null;
    if (mode === "clone" && !r) { error(repo.value.trim() ? "Use owner/repo, or an HTTPS or SSH Git URL." : "Which repository? Paste its URL or owner/repo."); repo.focus(); return; }
    if (!title) { error("Give the project a name."); name.focus(); return; }
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) { error("Use at least one letter or number in the name."); name.focus(); return; }
    if (ctx.world.state.projects.some((p) => p.id === id)) { error(`There's already a project called “${id}”. Pick another name.`); name.focus(); return; }
    const projectRoot = await loadRoot();
    if (signal.aborted) return;
    if (!projectRoot) { error("Can't create yet: the projects folder is unknown. Is the XO API running?"); return; }
    error("");
    setBusy(true, r);
    try {
      if (r) {
        const { clone_id } = await api.cloneProject({ id, url: r.url, displayName: title, description });
        if (signal.aborted) return;
        const end = await follow(clone_id);
        await done(id, title, description, `cloned from ${r.label} · plan and memory added`, end.warning);
      } else {
        await api.createProject({ path: `${projectRoot}/${id}`, displayName: title, description });
        await done(id, title, description, "created · folder, plan and memory scaffolded");
      }
    } catch (failure) {
      if (signal.aborted) return;
      if (failure instanceof ApiError && failure.code === "bad_answer") reportFailure(failure);
      setBusy(false);
      const err = projectFailure(failure);
      // Stop is gone: land on what starts it again
      if (err.code === "cancelled") { error(""); submit.focus(); ctx.announce("Stopped cloning. Nothing was kept."); return; }
      /** @type {CloneNotice} */
      const notice = r ? cloneError(err, r, id, gh) : [err.status === 409 ? `There's already a project called “${id}”. Pick another name.` : err.message, null, err.status === 409 ? "name" : undefined];
      const [text, action, focus] = notice;
      if (!dlg.open) ctx.heraldShow({ kind: "stopped", text: `${title} didn't ${r ? "clone" : "get created"}`, sub: text }, 6000);
      error(text, action);
      if (focus) (focus === "name" ? name : repo).focus();
      else if (!dlg.contains(document.activeElement)) submit.focus(); // nothing to fix by hand: Create again
    }
  }

  scope.listen(requireHtml("#cp-mode"), "click", (/** @type {Event} */ e) => {
    const chosen = e.target instanceof Element ? e.target.closest("[data-mode]")?.getAttribute("data-mode") : null;
    if (chosen && chosen !== mode) setMode(chosen);
  });
  scope.listen(requireHtml("#cp-mode"), "keydown", (e) => {
    if (!("key" in e) || typeof e.key !== "string" || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    e.preventDefault();
    setMode(mode === "empty" ? "clone" : "empty", { focus: false });
    requireHtml(`#cp-mode [data-mode="${mode}"]`).focus();
  });
  scope.listen(form, "click", (/** @type {Event} */ e) => {
    const action = e.target instanceof Element ? e.target.closest("[data-cp]")?.getAttribute("data-cp") : null;
    if (action === "connect") { e.preventDefault(); connect(); }
    // the device code: said copied only once it is; refused, said so (the code stays on screen to type)
    if (action === "copy" && gh.code) copyText(gh.code).then((ok) => {
      if (!signal.aborted) ctx.announce(ok ? "Copied the code." : COPY_REFUSED);
    });
  });
  scope.listen(repo, "input", () => {
    error("");
    renderRepoIcon();
    renderGh();
    const r = parseRepo(repo.value);
    if (!nameTouched) { name.value = r?.name ?? ""; renderWhere(); }
  });
  scope.listen(name, "input", () => { nameTouched = !!name.value; renderWhere(); error(""); });
  scope.listen(cancel, "click", () => close());
  scope.listen(requireHtml("#cp-stop", "button"), "click", stop);
  scope.listen(form, "submit", (/** @type {Event} */ e) => { e.preventDefault(); submitForm(); });
  scope.listen(dlg, "cancel", (/** @type {Event} */ e) => { e.preventDefault(); close(); });
  return { open, close, isOpen: () => dlg.open };
}
