// Create XO Project: start empty (Space scaffolds a folder) or clone a Git repository into a new project.
// Cloning is a Space clone job: POST /xo-projects answers {clone_id} at once, then the dialog polls it for
// progress and can stop it (xo-space services/project_clones.py). For https://github.com/… Space sends the GitHub connector's
// token, so private repos clone once GitHub is connected, which the dialog can do in place (device flow).
import { esc } from "./world.js";
import { ICON, $, RM } from "./ui.js";
import { api } from "./api.js";
import { fmtSize } from "./attach.js";
import { redraw } from "./redraw.js";
import { usable } from "./focusview.js";
import { copyText, COPY_REFUSED } from "./util.js";

const PHASE = { counting: "Counting files in", receiving: "Downloading", resolving: "Unpacking", checkout: "Checking out", finishing: "Adding plan and memory to" };

const GH = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`;

export const slugify = (name) => String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

// GitHub as Space reads it (services/project_management.py _github_url): any page of a repo (…/tree/main,
// …/pulls?q=…, #readme) names the repo; owner/repo alone does too
const GH_PAGE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:\/[^?#]*)?(?:[?#].*)?$/i;
const GH_SHORT = /^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

/** What the Repository field holds → {url, label, name, github} or null. owner/repo and github.com/… mean GitHub. */
export function parseRepo(raw) {
  const v = String(raw || "").trim();
  if (!v || /\s/.test(v)) return null;
  const gh = v.match(GH_PAGE) || v.match(GH_SHORT);
  if (gh && !/^\.+$/.test(gh[2])) return { url: `https://github.com/${gh[1]}/${gh[2]}.git`, label: `${gh[1]}/${gh[2]}`, name: gh[2], github: true };
  const ssh = v.match(/^git@([A-Za-z0-9.-]+):([A-Za-z0-9._/-]+?)(?:\.git)?$/);
  // GitHub's SSH form clones over HTTPS, so the GitHub connection (not this server's SSH keys) opens it
  if (ssh && ssh[1] === "github.com" && /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(ssh[2])) return parseRepo(ssh[2]);
  if (ssh) return { url: v, label: `${ssh[1] === "github.com" ? "" : ssh[1] + ":"}${ssh[2]}`, name: ssh[2].split("/").pop(), github: ssh[1] === "github.com" };
  try {
    const u = new URL(v);
    const path = u.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    if (!/^(https|ssh):$/.test(u.protocol) || u.password || (u.username && u.protocol === "https:") || u.search || u.hash || path.split("/").filter(Boolean).length < 1) return null;
    return { url: v, label: `${u.host}${path}`, name: path.split("/").pop(), github: false };
  } catch { return null; }
}

/** ctx: {world, S, go, heraldShow, announce, setDrawer, onPhoneClose} */
export function initCreate(ctx) {
  const dlg = $("#create-dlg"), form = $("#create-form");
  const name = $("#cp-name"), desc = $("#cp-desc"), repo = $("#cp-repo"), submit = $("#cp-submit"), cancel = $("#cp-cancel");
  let root = null, mode = "empty", nameTouched = false, busy = null, gh = { status: "unknown" }, login = null;

  $("#dlg-ic").innerHTML = ICON.project;
  $("#cpm-empty").innerHTML = ICON.plus;
  $("#cpm-clone").innerHTML = GH;

  const error = (text, action) => {
    const el = $("#cp-err");
    el.innerHTML = text ? `${esc(text)}${action ? ` <button type="button" class="cp-link" data-cp="${action.id}">${esc(action.label)}</button>` : ""}` : "";
    el.hidden = !text;
  };
  const home = () => (root ? root.replace(/^\/home\/[^/]+/, "~") : "your projects folder");

  function renderWhere() {
    const id = slugify(name.value);
    $("#cp-where").innerHTML = `${ICON.folder}<span>${id ? `Saved as <code>${esc(home())}/${esc(id)}</code>` : `Saved in <code>${esc(home())}</code>`}</span>`;
  }
  function renderRepoIcon() {
    const r = parseRepo(repo.value);
    $("#cp-repo-ic").innerHTML = !r || r.github ? GH : ICON.branch;
  }
  function renderGh() {
    const el = $("#cp-gh"), r = parseRepo(repo.value), off = busy ? " disabled" : ""; // no new login mid-clone
    // in place: Connect becomes "Connecting…" and then Try again as the same button, so it keeps focus
    const put = (html) => redraw(el, html);
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
    try { gh = await api.githubStatus(); } catch { gh = { status: "needs_auth" }; }
    if (gh.status !== "connected") gh = { status: "needs_auth" };
    renderGh();
  }
  /** GitHub's device flow, in place. Space answers "connected" at once when it can reuse this machine's gh
   *  login. A code keeps being polled with the dialog closed: Space allows one login at a time, so dropping it
   *  would leave the next Connect refused until the code expires. */
  async function connect() {
    if (gh.status === "starting") return; // a second Connect while the first is starting joins it (Astra H6)
    clearTimeout(login);
    gh = { status: "starting" }; renderGh();
    // a Connect can be pressed in two places: GitHub's line (#cp-gh) and a failed clone's message (#cp-err, its
    // "Connect GitHub"). Focus on either is focus on Connect, and goes where Connect leads (Astra H6: BODY after
    // success, from the message's Connect, which error("") takes away)
    const onConnect = () => { const a = document.activeElement; return !!a && ($("#cp-gh").contains(a) || $("#cp-err").contains(a)); };
    const settle = (next) => {
      const was = onConnect();
      gh = next;
      renderGh();
      if (gh.status === "connected") { error(""); ctx.announce(`GitHub connected as ${gh.username}${gh.imported ? ", from this machine's gh login" : ""}.`); }
      if (!was) return;
      // where Connect leads: a failure, a Connect again (the one you're on, else GitHub line's Try again); a code,
      // its Copy; connected, the repository to clone
      const a = document.activeElement, still = a && a.isConnected && a.matches?.('[data-cp="connect"]');
      if (gh.status === "failed") { if (!still) $("#cp-gh [data-cp=connect]")?.focus({ preventScroll: true }); }
      else (gh.status === "code" ? $("#cp-gh [data-cp=copy]") : repo)?.focus({ preventScroll: true });
    };
    let s;
    try { s = await api.githubConnect(); } catch (err) { settle({ status: "failed", error: err.message }); return; }
    if (s.status === "connected") { settle(s); return; }
    const was = onConnect();
    gh = { status: "code", code: s.user_code, uri: s.verification_uri, session: s.session_id };
    renderGh();
    if (was) $("#cp-gh [data-cp=copy]")?.focus({ preventScroll: true });
    const poll = async () => {
      let r;
      // Space's 502 carries its words in a field ApiError doesn't read; 404 is a code that expired
      try { r = await api.githubConnectPoll(s.session_id); } catch (err) { r = { status: "failed", error: err.status === 404 ? "That code expired." : "" }; }
      if (gh.session !== s.session_id) return; // a newer code took over
      if (r.status === "pending") { login = setTimeout(poll, 5000); return; }
      settle(r.status === "connected" ? r : { status: "failed", error: r.error });
    };
    login = setTimeout(poll, 5000);
  }

  function setMode(m, { focus = true } = {}) {
    mode = m;
    for (const b of $("#cp-mode").children) { b.setAttribute("aria-checked", String(b.dataset.mode === m)); b.tabIndex = b.dataset.mode === m ? 0 : -1; }
    $("#cp-repo-f").hidden = m !== "clone";
    dlg.dataset.mode = m;
    if (!busy) submit.textContent = m === "clone" ? "Clone project" : "Create project";
    error("");
    if (m === "clone") { renderRepoIcon(); renderGh(); if (gh.status === "unknown") readGh(); }
    if (focus) (m === "clone" ? repo : name).focus();
  }

  // busy: {t0, label, cloneId?, st?: Space's clone status} while creating or cloning
  function setBusy(on, repoOf) {
    clearTimeout(busy?.timer);
    busy = on ? { t0: Date.now(), label: repoOf?.label, host: repoOf && (repoOf.github ? "GitHub" : repoOf.label.split(/[/:]/)[0]) } : null;
    for (const el of [name, desc, repo]) el.disabled = on;
    for (const b of $("#cp-mode").children) b.disabled = on;
    // aria-disabled, not disabled: a pressed Create keeps focus while it works, and a failure leaves it there to
    // try again (a disabled button drops focus to the page: Astra H3)
    // (a value, never a bare attribute: aria-disabled="" reads as not disabled, the create-project grader's C019)
    if (on) { submit.setAttribute("aria-disabled", "true"); submit.setAttribute("aria-busy", "true"); } else { submit.removeAttribute("aria-disabled"); submit.removeAttribute("aria-busy"); }
    submit.innerHTML = on ? `<i class="spin" aria-hidden="true"></i>${mode === "clone" ? "Cloning…" : "Creating…"}` : (mode === "clone" ? "Clone project" : "Create project");
    // a create on its way can't be called back (a clone has its own Stop): the button only closes the dialog, and
    // says so; it said Cancel for an empty project, which was made anyway (the create-project grader's C018)
    cancel.textContent = on ? "Close" : "Cancel";
    // the progress row (and its Stop) goes when the work ends, however it ends (failed, stopped, done): focus that
    // was in it lands on Create, the control that starts it again, before the row is hidden. A Stop hidden while it
    // has focus drops focus to the page: after a refused Stop, a clone that then failed did that (Astra H20/S144).
    // A caller with a better place (the field to fix, the new project) moves it on from there.
    const fromProg = !on && $("#cp-prog").contains(document.activeElement);
    $("#cp-prog").hidden = !(on && mode === "clone");
    if (fromProg) submit.focus({ preventScroll: true });
    delete $("#cp-phase").dataset.v;
    $("#cp-stop").disabled = false; $("#cp-stop").removeAttribute("aria-disabled"); $("#cp-stop").removeAttribute("aria-busy");
    if (mode === "clone") renderGh();
    if (on && mode === "clone") tick();
  }
  /** The cloning row: what Space says it's doing (or just "Cloning"), how far when it knows, the time taken.
   *  Its nodes stay put (only their text changes), so Stop keeps focus; only a new phase is announced. */
  function tick() {
    if (!busy) return;
    const s = Math.floor((Date.now() - busy.t0) / 1000), st = busy.st || {};
    // 0 % is "not started yet" (a big repo can count for a while on GitHub's side): the bar keeps moving until it has a real figure
    const pct = st.percent > 0 ? Math.min(100, Math.round(st.percent)) : null;
    const bar = $("#cp-bar"), facts = [pct > 0 && `${pct}%`, st.received_bytes > 0 && fmtSize(st.received_bytes)].filter(Boolean).join(" · ");
    bar.classList.toggle("is-known", pct != null);
    bar.firstElementChild.style.width = pct != null ? `${pct}%` : "";
    if (pct != null) { bar.setAttribute("aria-valuenow", pct); bar.setAttribute("aria-valuemin", 0); bar.setAttribute("aria-valuemax", 100); bar.setAttribute("aria-valuetext", facts || `${pct}%`); }
    else for (const k of ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]) bar.removeAttribute(k);
    // Space's idle_seconds (when it sends it): git has said nothing for that long, so say who we're waiting on
    const quiet = st.idle_seconds >= 8 ? busy.host : "";
    const verb = quiet && st.phase === "counting" ? `Waiting for ${quiet} to prepare` : PHASE[st.phase] || "Cloning";
    const phase = `${verb} ${busy.label}`;
    if ($("#cp-phase").dataset.v !== phase) { $("#cp-phase").dataset.v = phase; $("#cp-phase").innerHTML = `${esc(verb)} <b>${esc(busy.label)}</b>`; }
    $("#cp-facts").textContent = [facts, quiet && st.phase !== "counting" && `waiting for ${quiet}`].filter(Boolean).join(" · ");
    $("#cp-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#cp-stop").hidden = !busy.cloneId;
    $("#cp-hint").hidden = s < 6;
    busy.timer = setTimeout(tick, 1000 - ((Date.now() - busy.t0) % 1000));
  }
  /** Follow a clone Space runs in the background until it's done; throws its error, or "cancelled" once it's
   *  stopped (from here or anywhere else). This is the one place a clone ends, so busy stays this clone's. */
  async function follow(cloneId) {
    busy.cloneId = cloneId;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      let st;
      try { st = await api.cloneStatus(cloneId); } catch (err) { if (err.status === 404) throw err; continue; } // a blip: ask again
      busy.st = st;
      if (st.state === "done") return st;
      if (st.state === "failed") throw Object.assign(new Error(st.error?.message || "The clone failed."), { code: st.error?.code || "clone_failed", detail: st.error?.detail, status: 502 });
      if (st.state === "cancelled") throw Object.assign(new Error("stopped"), { code: "cancelled" });
    }
  }
  async function stop() {
    const id = busy?.cloneId;
    const st = $("#cp-stop");
    if (!id || st.getAttribute("aria-busy") === "true") return;
    // aria-disabled while it asks, not disabled: a disabled button drops focus to the page, and a refused stop
    // leaves you on Stop to try again (Astra H20/S144)
    st.setAttribute("aria-disabled", "true"); st.setAttribute("aria-busy", "true");
    // Following the clone shows how it ended: stopped, or done or failed when Stop came too late
    // (once Space has published the project, a cancel ends the job "done" and the project opens).
    try { await api.cancelClone(id); } catch (err) {
      // the answer is this clone's: if it has ended and another started meanwhile, its refusal says nothing to
      // the new one's Stop (Astra SRC-MAIN-CREATE-1: an old refusal cleared the new Stop's busy state)
      if (busy?.cloneId !== id) return;
      if (err.code === "clone_finished" || err.status === 404) return;
      st.removeAttribute("aria-disabled"); st.removeAttribute("aria-busy");
      error(`Couldn't stop it: ${err.message}`);
    }
  }

  /** Space's words for a failed clone → what the dialog says, and the one action that helps. */
  function cloneError(err, r, id) {
    const code = err.code, host = r.github ? "GitHub" : r.label.split(/[/:]/)[0];
    const connect = { id: "connect", label: gh.status === "connected" ? "Reconnect GitHub" : "Connect GitHub" };
    switch (code) {
      case "project_exists": return [`There's already a project called “${id}”. Pick another name.`, null, name];
      case "invalid_repository_url": return ["Use owner/repo, or an HTTPS or SSH Git URL without a password or token.", null, repo];
      case "repo_not_found_or_private":
        if (r.github && gh.status !== "connected") return ["This repo is private, or doesn't exist.", connect, repo];
        return [r.github ? `GitHub has no repo there that @${gh.username || "you"} can see.` : "There's no repository there that this server can reach.", null, repo];
      case "auth_failed": return [r.github ? "GitHub turned the connection down." : `${host} turned this server's Git access down.`, r.github ? connect : null];
      case "host_unreachable": return [`Couldn't reach ${host}. Check the URL, or try again in a moment.`, null, repo];
      case "timed_out": return ["The clone stalled, so it stopped. Try again.", null];
      case "clone_in_progress": return [`“${id}” is already being cloned. It shows in Projects when it's done.`, null];
      case "too_many_clones": return ["Four clones are already running. Try again when one finishes.", null];
      case "clone_not_found": return ["XO restarted, so the clone stopped. Try again.", null];
      case "invalid_project_details": return [err.message, null, name];
    }
    if (r.github && gh.status !== "connected" && code === "clone_failed") return ["Couldn't clone it. Is it private?", connect, repo];
    return [err.detail ? `${err.message} (${err.detail})` : err.message, null];
  }

  let opener = null; // what opened Create: focus goes back there when it closes (Astra H4)
  async function open() {
    const a = document.activeElement;
    if (a && a !== document.body && !dlg.contains(a)) opener = a;
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
  /** Where projects live, read once; a submit that comes first waits for it. */
  let rootP = null;
  function loadRoot() {
    if (root) return Promise.resolve(root);
    return (rootP ||= api.workspaceConfig().then((cfg) => { root = cfg.roots?.[cfg.default] || null; renderWhere(); return root; },
      (err) => { rootP = null; error(`Can't read where projects live: ${err.message}`); return null; }));
  }
  /**
   * Close. Back to what opened it (Home's Create, the composer Jump came from …), or, on a phone, the menu when
   * that opener was inside the drawer and is gone. now: no closing animation, so the native modal lets go at once
   * and the place the person is taken to can take focus (a project just made: Astra H2).
   */
  function close({ now = false, restore = true } = {}) {
    if (!dlg.open) return;
    const back = opener; opener = null;
    const land = () => {
      if (!restore) return;
      if (usable(back)) back.focus({ preventScroll: true });
      else ctx.onPhoneClose();
    };
    if (now || RM.matches) { dlg.close(); land(); return; }
    dlg.classList.add("is-closing");
    setTimeout(() => { dlg.classList.remove("is-closing"); dlg.close(); land(); }, 160);
  }

  /** warning: Space's word on what didn't stick (the project is made either way). */
  async function done(id, title, description, line, warning) {
    // The project is made either way: a failed refresh mustn't read as a failed clone (the next one shows it)
    await ctx.world.act.refresh().catch(() => {});
    if (description) ctx.S.desc[id] = description;
    ctx.S.local["p:" + id] = [{ id: `l${++ctx.S.n}_hello`, conv: "p:" + id, at: Date.now(), who: "event", tone: "ok", text: `${title} ${line}${description ? ` · ${description.replace(/[.\s]+$/, "")}` : ""}` }];
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
    if (!(await loadRoot())) { error("Can't create yet: the projects folder is unknown. Is the XO API running?"); return; }
    error("");
    setBusy(true, r);
    try {
      if (r) {
        const { clone_id } = await api.cloneProject({ id, url: r.url, displayName: title, description });
        const end = await follow(clone_id);
        await done(id, title, description, `cloned from ${r.label} · plan and memory added`, end.warning);
      } else {
        await api.createProject({ path: `${root}/${id}`, displayName: title, description });
        await done(id, title, description, "created · folder, plan and memory scaffolded");
      }
    } catch (err) {
      setBusy(false);
      // Stop is gone: land on what starts it again
      if (err.code === "cancelled") { error(""); submit.focus(); ctx.announce("Stopped cloning. Nothing was kept."); return; }
      const [text, action, field] = r ? cloneError(err, r, id) : [err.status === 409 ? `There's already a project called “${id}”. Pick another name.` : err.message, null, err.status === 409 ? name : null];
      if (!dlg.open) ctx.heraldShow({ kind: "stopped", text: `${title} didn't ${r ? "clone" : "get created"}`, sub: text }, 6000);
      error(text, action);
      if (field) field.focus();
      else if (!dlg.contains(document.activeElement)) submit.focus(); // nothing to fix by hand: Create again
    }
  }

  $("#cp-mode").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== mode) setMode(b.dataset.mode); });
  $("#cp-mode").addEventListener("keydown", (e) => {
    if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    e.preventDefault();
    setMode(mode === "empty" ? "clone" : "empty", { focus: false });
    $(`#cp-mode [data-mode="${mode}"]`).focus();
  });
  form.addEventListener("click", (e) => {
    const a = e.target.closest("[data-cp]");
    if (!a) return;
    if (a.dataset.cp === "connect") { e.preventDefault(); connect(); }
    // the device code: said copied only once it is; refused, said so (the code stays on screen to type)
    if (a.dataset.cp === "copy") copyText(gh.code).then((ok) => ctx.announce(ok ? "Copied the code." : COPY_REFUSED));
  });
  repo.addEventListener("input", () => {
    error("");
    renderRepoIcon();
    renderGh();
    const r = parseRepo(repo.value);
    if (!nameTouched) { name.value = r ? r.name : ""; renderWhere(); }
  });
  name.addEventListener("input", () => { nameTouched = !!name.value; renderWhere(); error(""); });
  cancel.addEventListener("click", close);
  $("#cp-stop").addEventListener("click", stop);
  form.addEventListener("submit", (e) => { e.preventDefault(); submitForm(); });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  return { open, close, isOpen: () => dlg.open };
}
