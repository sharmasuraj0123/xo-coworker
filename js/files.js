// Files: the panel's file browser, and the one place a file opens (design-research/13). The idea is
// xo-swarm's org-mode browser (app/org/[orgId]/_components/ProjectFileTree.tsx): a tree read a folder
// at a time, the README as the project's front page, the file beside the tree when there's room and
// one at a time when there isn't. Ours on top: what the agents touched, marked where it is.
//
// What it shows follows the view: a thread, its own worktree (its branch); a project, its folder;
// Home, the Workspace and Chats, your projects to pick from. Read-only: nothing here writes.
//
// The file itself is the viewer (js/viewer.js), moved in here. A file opened from anywhere (a chip in
// a turn, Made, the Map) comes forward in Files, shown in its folder when it's in the one on screen.
//
// What it reads: GET /api/xo-projects/<project>/tree (one level per call: dirs and files with size and
// time), the file routes the viewer reads, and the turns the stream already brings (activityOf, the
// Map's pure reader of a session's file steps).
//
// stage.js calls: mount, show, hide, render, reveal, count.

import { esc } from "./util.js";
import { ICON } from "./ui.js";
import { api } from "./api.js";
import { activityOf, folderOf } from "./map.js";
import { fileIcon, folderIcon } from "./fileicons.js";

const WIDE = 600;       // the panel's width from which tree and file sit side by side (the panel goes to 720)
const TOUCHED = 6;      // "Touched by agents" shows at most this many

const I = (d, w = 15) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const FILES_ICON = I('<path d="M3.5 18V6.5A1.5 1.5 0 0 1 5 5h4l2 2h8A1.5 1.5 0 0 1 20.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>', 16);
const CH = I('<path d="m9 6 6 6-6 6"/>', 13);
const BACK = I('<path d="m15 6-6 6 6 6"/>');

const size = (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const base = (p) => String(p || "").split("/").pop();
const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
const MARK_WORD = { new: "new", edited: "edited", deleted: "deleted" };

/** The folder a view shows: {key, project, base (the API path of its root), label, sub} or {key: "all"}. */
export function scopeOf(view, { thread, project }) {
  if (view && view.startsWith("t:")) {
    const t = thread(view.slice(2));
    const f = t && folderOf(t);
    if (f) return { key: `${f.project}|${f.base}`, project: f.project, base: f.base, label: project(f.project), sub: f.base ? t.branch || "its worktree" : "", tid: t.id };
    if (t && t.project && t.project !== "workspace") return { key: `${t.project}|`, project: t.project, base: "", label: project(t.project), sub: "" };
  }
  if (view && view.startsWith("p:")) return { key: `${view.slice(2)}|`, project: view.slice(2), base: "", label: project(view.slice(2)), sub: "" };
  return { key: "all" };
}

/** Where a file the viewer opened sits in a scope: its path inside it, or null when it's elsewhere. */
export function localIn(scope, f) {
  if (!scope || !scope.project || !f || f.project !== scope.project || !f.rel) return null;
  const rel = String(f.rel);
  if (scope.base) return rel.startsWith(scope.base + "/") ? rel.slice(scope.base.length + 1) : null;
  return rel.startsWith(".xo/") ? null : rel;
}

export function createFiles({ world, viewer, isBusy, PROJ, go }) {
  const F = {
    host: null, view: "home", scope: { key: "all" }, pick: null, shown: false,
    dirs: new Map(),     // "<project>|<api path>" → {state, dirs, files, error}
    open: new Map(),     // scope key → Set of open folders (paths inside the scope)
    sel: null,           // the file shown, inside the scope (null: none, or one from elsewhere)
    fileView: false,     // narrow: the file is in front of the tree
    auto: false,         // the README was opened by us, not by you
    q: "", wide: false,
  };
  const setOf = (k) => { if (!F.open.has(k)) F.open.set(k, new Set()); return F.open.get(k); };
  const apiRel = (s, local) => (s.base ? (local ? `${s.base}/${local}` : s.base) : local);
  const dkey = (s, local) => `${s.project}|${apiRel(s, local)}`;

  // ── reading a folder ──────────────────────────────────────────────────────
  async function load(s, local, { again = false } = {}) {
    const k = dkey(s, local);
    const had = F.dirs.get(k);
    if (had && (had.state === "loading" || (had.state === "ok" && !again))) return had;
    F.dirs.set(k, { ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading" });
    try {
      const d = await api.projectTree(s.project, apiRel(s, local));
      const strip = (e) => { let p = String(e.relative_path || e.name); if (s.base && p.startsWith(s.base + "/")) p = p.slice(s.base.length + 1); return { name: e.name, path: p, bytes: e.size_bytes ?? null, at: Date.parse(e.modified_at) || 0 }; };
      F.dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip) });
    } catch (err) {
      F.dirs.set(k, { state: "error", error: err.status === 404 ? "Not there any more" : "Couldn't read it" });
    }
    paint();
    return F.dirs.get(k);
  }

  // ── what agents touched, in this scope ────────────────────────────────────
  function touched(s) {
    if (!s.project) return [];
    const turns = world.state.turns;
    const ts = world.state.threads.filter((t) => t.project === s.project && (!s.tid || t.id === s.tid));
    const out = new Map();
    for (const t of ts) {
      const f = folderOf(t);
      if (!f || !t.sessionId) continue;
      const a = activityOf(turns, t.sessionId, f.root);
      for (const x of a.files.values()) {
        if (x.mark === "read" && !x.live) continue;
        // in a project, a thread's file is its worktree's: opening it reads that copy
        const local = s.base === f.base ? x.path : null;
        const at = { path: x.path, local, rel: f.base ? `${f.base}/${x.path}` : x.path, mark: x.mark, live: x.live, seq: x.seq, who: t.title, tid: t.id, busy: isBusy(t) };
        const prev = out.get(x.path);
        if (!prev || (at.live && !prev.live) || (at.busy && !prev.busy)) out.set(x.path, at);
      }
    }
    return [...out.values()].sort((a, b) => (b.live - a.live) || (b.busy - a.busy) || b.seq - a.seq);
  }
  const markOf = (x) => (x.live ? "live" : x.mark);
  const dot = (x, words = false) => `<span class="fl-who w-${markOf(x)}"${words ? "" : ` title="${esc(`${x.live ? "Being edited now" : MARK_WORD[x.mark] || x.mark} by ${x.who}`)}"`}><i></i>${words ? esc(x.live ? "editing now" : MARK_WORD[x.mark] || "") : ""}</span>`;

  // ── drawing ───────────────────────────────────────────────────────────────
  function rowsOf(s, local, depth, marks, out) {
    const d = F.dirs.get(dkey(s, local));
    if (!d || (d.state === "loading" && !d.dirs)) { out.push(`<p class="fl-note" style="--d:${depth}"><i class="spin" aria-hidden="true"></i>Reading…</p>`); return; }
    if (d.state === "error") { out.push(`<p class="fl-note is-err" style="--d:${depth}">${esc(d.error)} <button type="button" class="fl-link" data-fl-retry="${esc(local)}">Try again</button></p>`); return; }
    const q = F.q.trim().toLowerCase();
    const open = setOf(s.key);
    for (const x of d.dirs) {
      const on = open.has(x.path);
      if (q && !x.name.toLowerCase().includes(q) && !on) continue;
      out.push(`<button type="button" class="fl-r is-dir${on ? " is-open" : ""}" style="--d:${depth}" data-fl-dir="${esc(x.path)}" aria-expanded="${on}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(x.name)}</span>${marks.dirs.has(x.path) ? `<span class="fl-who w-${marks.dirs.get(x.path)}"><i></i></span>` : ""}</button>`);
      if (on) rowsOf(s, x.path, depth + 1, marks, out);
    }
    for (const x of d.files) {
      if (q && !x.name.toLowerCase().includes(q)) continue;
      const m = marks.files.get(x.path);
      out.push(`<button type="button" class="fl-r${F.sel === x.path ? " is-on" : ""}" style="--d:${depth}" data-fl-file="${esc(x.path)}" data-fl-bytes="${x.bytes ?? ""}" title="${esc(x.path)}"><span class="fl-c fl-i">${fileIcon(x.name)}</span><span class="fl-n">${esc(x.name)}</span>${m ? dot(m) : ""}<span class="fl-sz">${esc(size(x.bytes))}</span></button>`);
    }
    if (!d.dirs.length && !d.files.length) out.push(`<p class="fl-note" style="--d:${depth}">Empty</p>`);
  }

  function treeHtml(s) {
    if (s.key === "all") {
      const ps = (world.state.projects || []).filter((p) => p && p.id !== "workspace");
      return `<div class="fl-head"><div class="fl-crumb"><b>Projects</b></div></div><div class="fl-list">` +
        ps.map((p) => `<button type="button" class="fl-r is-dir" style="--d:0" data-fl-pick="${esc(p.id)}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(p.name || p.id)}</span>${world.state.threads.some((t) => t.project === p.id && isBusy(t)) ? `<span class="fl-who w-live" title="Agents at work"><i></i></span>` : ""}</button>`).join("") + `</div>`;
    }
    const tl = touched(s);
    const marks = { files: new Map(), dirs: new Map() };
    for (const x of tl) {
      if (x.local == null) continue;
      marks.files.set(x.local, x);
      for (let p = parentOf(x.local); p; p = parentOf(p)) if (!marks.dirs.has(p) || x.live) marks.dirs.set(p, markOf(x));
    }
    const rows = [];
    rowsOf(s, "", 0, marks, rows);
    const head = `<div class="fl-head"><div class="fl-crumb">${F.pick ? `<button type="button" class="fl-up" data-fl-unpick title="Your projects">${BACK}</button>` : ""}<b>${esc(s.label)}</b>${s.sub ? `<small title="${s.base ? "A thread's own worktree: its branch" : ""}">${esc(s.sub)}</small>` : ""}</div>` +
      `<label class="fl-q"><span class="sr-only">Find a file</span>${ICON.search}<input data-fl-q placeholder="Find a loaded file" value="${esc(F.q)}" autocomplete="off" spellcheck="false"></label></div>`;
    const top = tl.slice(0, TOUCHED);
    const sec = top.length ? `<p class="fl-sec">Touched by agents</p>` + top.map((x) => `<button type="button" class="fl-r is-touch" style="--d:0" data-fl-touch="${esc(x.rel)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="fl-c fl-i">${fileIcon(x.path)}</span><span class="fl-n">${esc(x.path)}</span>${dot(x, true)}</button>`).join("") + `<p class="fl-sec">All files</p>` : "";
    return head + `<div class="fl-list">${sec}${rows.join("")}</div>`;
  }

  function paint() {
    if (!F.host || !F.shown) return;
    const s = F.scope;
    const tree = F.host.querySelector(".fl-tree");
    const q = tree.querySelector("[data-fl-q]");
    const typing = q && document.activeElement === q;
    const caret = typing ? [q.selectionStart, q.selectionEnd] : null;
    const html = treeHtml(s);
    if (tree._h !== html) {
      const list = tree.querySelector(".fl-list"), top = list ? list.scrollTop : 0;
      tree.innerHTML = html; tree._h = html;
      const l2 = tree.querySelector(".fl-list"); if (l2) l2.scrollTop = top;
      if (caret) { const q2 = tree.querySelector("[data-fl-q]"); q2.focus(); q2.setSelectionRange(...caret); }
    }
    const has = viewer.hasFile;
    const lay = F.host.querySelector(".fl");
    lay.classList.toggle("is-wide", F.wide);
    lay.classList.toggle("is-file", !F.wide && has && F.fileView);
    lay.classList.toggle("has-file", has);
    const bar = F.host.querySelector(".fl-bar");
    const bh = has && !F.wide ? `<button type="button" class="fl-back" data-fl-back>${BACK}<span>${esc(s.key === "all" ? "Projects" : s.label || "Files")}</span></button>` : "";
    if (bar._h !== bh) { bar.innerHTML = bh; bar._h = bh; }
  }

  // ── opening ───────────────────────────────────────────────────────────────
  function openFile(s, local, from, bytes = null) {
    F.sel = local; F.fileView = true; F.auto = false;
    viewer.open({ path: local, name: base(local), bytes, project: s.project, rel: apiRel(s, local) }, from);
  }
  /** Wide, nothing chosen: the README is the front page, as GitHub shows one. */
  async function frontPage() {
    const s = F.scope;
    if (!F.wide || !s.project || viewer.hasFile) return;
    const d = await load(s, "");
    if (F.scope !== s || viewer.hasFile || !d || d.state !== "ok") return;
    const r = d.files.find((x) => /^readme\.(md|mdx|markdown|txt)$/i.test(x.name)) || null;
    if (!r) return;
    F.sel = r.path; F.auto = true;
    viewer.open({ path: r.path, name: r.name, bytes: r.bytes, project: s.project, rel: apiRel(s, r.path) }, null);
  }
  /** The viewer opened a file (from anywhere): show it, and find it in the tree when it's in this folder. */
  async function reveal(f) {
    if (!f) return;
    const s = F.scope;
    const local = localIn(s, f);
    F.sel = local; F.fileView = true;
    if (local == null) { paint(); return; }
    const open = setOf(s.key);
    const chain = [];
    for (let p = parentOf(local); p; p = parentOf(p)) chain.unshift(p);
    for (const p of chain) open.add(p);
    paint();
    for (const p of ["", ...chain]) { await load(s, p); if (F.scope !== s) return; }
    requestAnimationFrame(() => F.host && F.host.querySelector(`.fl-r.is-on`)?.scrollIntoView({ block: "nearest" }));
  }

  function setScope(view) {
    F.view = view;
    let s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
    if (s.key === "all" && F.pick) s = { key: `${F.pick}|`, project: F.pick, base: "", label: PROJ(F.pick), sub: "" };
    if (s.key !== F.scope.key) {
      F.scope = s; F.q = ""; F.sel = null;
      if (s.project) load(s, "");
      return true;
    }
    F.scope = s;
    return false;
  }

  // ── input ─────────────────────────────────────────────────────────────────
  function wire(host) {
    host.addEventListener("click", (e) => {
      const t = e.target;
      const dirB = t.closest("[data-fl-dir]");
      if (dirB) {
        const p = dirB.dataset.flDir, open = setOf(F.scope.key);
        if (open.has(p)) open.delete(p); else { open.add(p); load(F.scope, p); }
        paint(); return;
      }
      const fb = t.closest("[data-fl-file]");
      if (fb) { openFile(F.scope, fb.dataset.flFile, fb, fb.dataset.flBytes === "" ? null : Number(fb.dataset.flBytes)); return; }
      const tc = t.closest("[data-fl-touch]");
      if (tc) {
        const rel = tc.dataset.flTouch, s = F.scope;
        F.fileView = true; F.auto = false; F.sel = localIn(s, { project: s.project, rel });
        viewer.open({ path: rel, name: base(rel), project: s.project, rel }, tc); return;
      }
      const pk = t.closest("[data-fl-pick]");
      if (pk) { F.pick = pk.dataset.flPick; setScope(F.view); paint(); frontPage(); return; }
      if (t.closest("[data-fl-unpick]")) { F.pick = null; viewer.close({ restore: false }); setScope(F.view); paint(); return; }
      const rt = t.closest("[data-fl-retry]");
      if (rt) { load(F.scope, rt.dataset.flRetry, { again: true }); return; }
      if (t.closest("[data-fl-back]")) { F.fileView = false; if (!F.wide) viewer.close({ restore: false }); paint(); host.querySelector(".fl-r.is-on, .fl-r")?.focus({ preventScroll: true }); }
    });
    host.addEventListener("input", (e) => { if (e.target.matches("[data-fl-q]")) { F.q = e.target.value; paint(); } });
    host.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.matches("[data-fl-q]") && e.target.value) { e.preventDefault(); e.stopPropagation(); F.q = ""; e.target.value = ""; paint(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [...host.querySelectorAll(".fl-tree .fl-r")];
      const i = rows.indexOf(document.activeElement);
      if (i < 0 && !e.target.matches("[data-fl-q]")) return;
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    });
    if (typeof ResizeObserver === "function") new ResizeObserver(() => {
      const w = host.getBoundingClientRect().width >= WIDE;
      if (w !== F.wide) { F.wide = w; paint(); if (w) frontPage(); }
    }).observe(host);
  }

  return {
    /** Once: draw inside the Files tab; the viewer moves in beside the tree. */
    mount(host) {
      F.host = host;
      host.innerHTML = `<div class="fl"><div class="fl-tree"></div><div class="fl-pv"><div class="fl-bar"></div><div class="fl-view"></div><p class="fl-empty">Pick a file to read it here.</p></div></div>`;
      const vw = document.getElementById("viewer");
      if (vw) host.querySelector(".fl-view").appendChild(vw);
      wire(host);
    },
    show(view) {
      F.shown = true;
      F.wide = F.host.getBoundingClientRect().width >= WIDE;
      setScope(view);
      paint();
      frontPage();
    },
    hide() { F.shown = false; },
    /** Every app render: follow the view (a new scope starts fresh), and the agents' marks. */
    render(view) {
      if (!F.shown) return;
      if (setScope(view)) { if (F.auto || !viewer.hasFile) { if (viewer.hasFile) viewer.close({ restore: false }); F.fileView = false; } frontPage(); }
      if (!viewer.hasFile) { F.sel = null; F.fileView = false; }
      paint();
    },
    reveal,
    /** The file came from you (a click), not from the front page: the panel treats it as yours. */
    get auto() { return F.auto; },
  };
}
