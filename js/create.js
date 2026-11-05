// Create XO Project: start empty (Space scaffolds a folder) or clone a Git repository into a new project.
// Cloning goes through Space's POST /xo-projects. For https://github.com/… Space sends the GitHub connector's
// token, so private repos clone once GitHub is connected, which the dialog can do in place (device flow).
import { esc } from "./world.js";
import { ICON, $, RM } from "./ui.js";
import { api } from "./api.js";
import { fmtSize } from "./attach.js";

/** Space's clone v2 (xo-space, asked 2026-11-05): keeps name and brief, answers 202 {clone_id} with progress
 *  and cancel, and names its failures. Flip to true once :5002 runs it; nothing else changes here. */
const CLONE_V2 = false; // contract: xo-space docs/xo-projects-clone.md
const PHASE = { counting: "Counting files in", receiving: "Downloading", resolving: "Unpacking", checkout: "Checking out", finishing: "Adding plan and memory to" };

const GH = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`;

export const slugify = (name) => String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

/** What the Repository field holds → {url, label, name, github} or null. owner/repo and github.com/… mean GitHub. */
export function parseRepo(raw) {
  const v = String(raw || "").trim();
  if (!v || /\s/.test(v)) return null;
  const gh = v.match(/^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:\/(?:tree|blob)\/.*)?\/?$/);
  if (gh && !/^\.+$/.test(gh[2])) return { url: `https://github.com/${gh[1]}/${gh[2]}.git`, label: `${gh[1]}/${gh[2]}`, name: gh[2], github: true };
  const ssh = v.match(/^git@([A-Za-z0-9.-]+):([A-Za-z0-9._/-]+?)(?:\.git)?$/);
  // GitHub's SSH form clones over HTTPS, so the GitHub connection (not this server's SSH keys) opens it
  if (ssh && ssh[1] === "github.com" && /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(ssh[2])) return parseRepo(ssh[2]);
  if (ssh) return { url: v, label: `${ssh[1] === "github.com" ? "" : ssh[1] + ":"}${ssh[2]}`, name: ssh[2].split("/").pop(), github: ssh[1] === "github.com" };
  try {
    const u = new URL(v);
    const path = u.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    if (!/^(https|ssh):$/.test(u.protocol) || u.password || u.search || u.hash || path.split("/").filter(Boolean).length < 1) return null;
    return { url: v, label: `${u.host}${path}`, name: path.split("/").pop(), github: false };
  } catch { return null; }
}

/** ctx: {world, S, go, heraldShow, announce, setDrawer, PHONE, onPhoneClose} */
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
    const el = $("#cp-gh"), r = parseRepo(repo.value);
    if (r && !r.github) { el.innerHTML = `${ICON.key}<span>Cloned with this server's own Git access.</span>`; return; }
    if (gh.status === "connected") { el.innerHTML = `${ICON.check}<span>Connected as <b>@${esc(gh.username || "you")}</b>. Private repos work too.</span>`; el.dataset.tone = "ok"; return; }
    delete el.dataset.tone;
    if (gh.status === "unknown") { el.innerHTML = `<i class="spin" aria-hidden="true"></i><span>Checking GitHub…</span>`; return; }
    if (gh.status === "code") {
      el.innerHTML = `${ICON.key}<span>Enter <b class="cp-code">${esc(gh.code)}</b> on GitHub. <a class="cp-link" href="${esc(gh.uri)}" target="_blank" rel="noopener" data-cp="copy">Copy code and open GitHub</a></span>`;
      return;
    }
    if (gh.status === "failed") { el.innerHTML = `${ICON.lock}<span>${esc(gh.error || "GitHub didn't connect.")} <button type="button" class="cp-link" data-cp="connect">Try again</button></span>`; return; }
    el.innerHTML = `${ICON.lock}<span><button type="button" class="cp-link" data-cp="connect">Connect GitHub</button> to clone private repos.</span>`;
  }

  async function readGh() {
    try { gh = await api.githubStatus(); } catch { gh = { status: "needs_auth" }; }
    if (gh.status !== "connected") gh = { status: "needs_auth" };
    renderGh();
  }
  async function connect() {
    try {
      const s = await api.githubConnect();
      gh = { status: "code", code: s.user_code, uri: s.verification_uri, session: s.session_id };
      renderGh();
      clearTimeout(login);
      const poll = async () => {
        if (!dlg.open || gh.session !== s.session_id) return;
        try {
          const r = await api.githubConnectPoll(s.session_id);
          if (r.status === "pending") { login = setTimeout(poll, 5000); return; }
          gh = r.status === "connected" ? r : { status: "failed", error: r.error };
        } catch (err) { gh = { status: "failed", error: err.message }; }
        renderGh();
        if (gh.status === "connected") { error(""); ctx.announce(`GitHub connected as ${gh.username}.`); }
      };
      login = setTimeout(poll, 5000);
    } catch (err) { gh = { status: "failed", error: err.message }; renderGh(); }
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
  function setBusy(on, label) {
    clearTimeout(busy?.timer);
    busy = on ? { t0: Date.now(), label } : null;
    for (const el of [name, desc, repo]) el.disabled = on;
    for (const b of $("#cp-mode").children) b.disabled = on;
    submit.disabled = on;
    submit.innerHTML = on ? `<i class="spin" aria-hidden="true"></i>${mode === "clone" ? "Cloning…" : "Creating…"}` : (mode === "clone" ? "Clone project" : "Create project");
    cancel.textContent = on && mode === "clone" ? "Close" : "Cancel";
    $("#cp-prog").hidden = !(on && mode === "clone");
    delete $("#cp-phase").dataset.v;
    $("#cp-stop").disabled = false;
    if (on && mode === "clone") tick();
  }
  /** The cloning row: what Space says it's doing (or just "Cloning"), how far when it knows, the time taken.
   *  Its nodes stay put (only their text changes), so Stop keeps focus; only a new phase is announced. */
  function tick() {
    if (!busy) return;
    const s = Math.floor((Date.now() - busy.t0) / 1000), st = busy.st || {};
    const pct = Number.isFinite(st.percent) ? Math.max(0, Math.min(100, Math.round(st.percent))) : null;
    const bar = $("#cp-bar"), facts = [pct > 0 && `${pct}%`, st.received_bytes > 0 && fmtSize(st.received_bytes)].filter(Boolean).join(" · ");
    bar.classList.toggle("is-known", pct != null);
    bar.firstElementChild.style.width = pct != null ? `${pct}%` : "";
    if (pct != null) { bar.setAttribute("aria-valuenow", pct); bar.setAttribute("aria-valuemin", 0); bar.setAttribute("aria-valuemax", 100); bar.setAttribute("aria-valuetext", facts || `${pct}%`); }
    else for (const k of ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]) bar.removeAttribute(k);
    const phase = `${PHASE[st.phase] || "Cloning"} ${busy.label}`;
    if ($("#cp-phase").dataset.v !== phase) { $("#cp-phase").dataset.v = phase; $("#cp-phase").innerHTML = `${esc(PHASE[st.phase] || "Cloning")} <b>${esc(busy.label)}</b>`; }
    $("#cp-facts").textContent = facts;
    $("#cp-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#cp-stop").hidden = !busy.cloneId;
    $("#cp-hint").hidden = s < 6;
    busy.timer = setTimeout(tick, 1000 - ((Date.now() - busy.t0) % 1000));
  }
  /** v2: follow a clone Space runs in the background until it's done; throws its error. */
  async function follow(cloneId) {
    busy.cloneId = cloneId;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      if (!busy || busy.cloneId !== cloneId) throw Object.assign(new Error("stopped"), { code: "cancelled" });
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
    if (!id) return;
    $("#cp-stop").disabled = true;
    try { await api.cancelClone(id); } catch (err) {
      $("#cp-stop").disabled = false;
      if (err.code === "clone_finished") return; // it finished first: following it shows how
      if (err.status !== 404) { error(`Couldn't stop it: ${err.message}`); return; }
    }
    setBusy(false);
    error("");
    submit.focus(); // Stop is gone: land on what starts it again
    ctx.announce("Stopped cloning. Nothing was kept.");
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
      case "timeout": case "http_502": case "http_504": // today's blocking clone outlived the UI server's 120 s wait
        if (!CLONE_V2) return ["This is taking longer than the page waits. XO keeps cloning; the project shows in Projects when it's done.", null];
    }
    if (r.github && gh.status !== "connected" && code === "clone_failed") return ["Couldn't clone it. Is it private?", connect, repo];
    return [err.detail ? `${err.message} (${err.detail})` : err.message, null];
  }

  async function open() {
    ctx.setDrawer(false);
    if (busy) { dlg.showModal(); return; } // a clone still running: show it again as it is
    form.reset();
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
  function close() {
    if (!dlg.open) return;
    ctx.onPhoneClose();
    if (RM.matches) { dlg.close(); return; }
    dlg.classList.add("is-closing");
    setTimeout(() => { dlg.classList.remove("is-closing"); dlg.close(); }, 160);
  }

  async function done(id, title, description, line, where) {
    await ctx.world.act.refresh();
    if (description) ctx.S.desc[id] = description;
    ctx.S.local["p:" + id] = [{ id: `l${++ctx.S.n}_hello`, conv: "p:" + id, at: Date.now(), who: "event", tone: "ok", text: `${title} ${line}${description ? ` · ${description.replace(/[.\s]+$/, "")}` : ""}` }];
    const shown = dlg.open;
    setBusy(false);
    if (shown) { close(); ctx.go("p:" + id, { focus: true }); }
    ctx.heraldShow({ kind: "ready", text: `${title} is ready`, sub: where, open: "p:" + id }, 5200);
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
    setBusy(true, r?.label);
    try {
      if (r) {
        const res = await api.cloneProject({ id, url: r.url, displayName: title, description }, CLONE_V2);
        const end = res?.clone_id ? await follow(res.clone_id) : res;
        await done(id, title, description, `cloned from ${r.label} · plan and memory added`, end?.warning || `${root}/${id}`);
      } else {
        await api.createProject({ path: `${root}/${id}`, displayName: title, description });
        await done(id, title, description, "created · folder, plan and memory scaffolded", `${root}/${id}`);
      }
    } catch (err) {
      if (err.code === "cancelled") return;
      setBusy(false);
      const [text, action, field] = r ? cloneError(err, r, id) : [err.status === 409 ? `There's already a project called “${id}”. Pick another name.` : err.message, null, err.status === 409 ? name : null];
      if (!dlg.open) ctx.heraldShow({ kind: "stopped", text: `${title} didn't ${r ? "clone" : "get created"}`, sub: text }, 6000);
      error(text, action);
      field?.focus();
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
    if (a.dataset.cp === "copy") navigator.clipboard?.writeText(gh.code).catch(() => {});
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
