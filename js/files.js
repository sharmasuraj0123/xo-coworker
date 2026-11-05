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
import { countsHtml } from "./changesframe.js";

const WIDE = 600;       // the panel's width from which tree and file sit side by side (the panel goes to 720)
const TOUCHED = 6;      // "Touched by agents" shows at most this many
const ROW = 28;         // a row's height, and a heading's: the list is a whole number of them (css/panel.css)

const I = (d, w = 15) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const FILES_ICON = I('<path d="M3.5 18V6.5A1.5 1.5 0 0 1 5 5h4l2 2h8A1.5 1.5 0 0 1 20.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>', 16);
const CH = I('<path d="m9 6 6 6-6 6"/>', 13);
const BACK = I('<path d="m15 6-6 6 6 6"/>');
const CHANGED_IC = I('<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M9.5 13.5l2 2 3.5-4"/>', 16);
const FOLDER_IC = I('<path d="M3.5 18V6.5A1.5 1.5 0 0 1 5 5h4l2 2h8A1.5 1.5 0 0 1 20.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>', 16);

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

/** The folder a file lives in, as a scope: its thread's worktree when it's in one, else its project. */
export function fileScope(f, { threads, project }) {
  if (!f || !f.project || !f.rel) return null;
  const m = /^(\.xo\/worktrees\/[^/]+)\//.exec(String(f.rel));
  if (!m) return { key: `${f.project}|`, project: f.project, base: "", label: project(f.project), sub: "" };
  const t = (threads || []).find((x) => x && x.project === f.project && String(x.worktree || "").replace(/\/+$/, "").endsWith(`/${m[1]}`));
  return { key: `${f.project}|${m[1]}`, project: f.project, base: m[1], label: project(f.project), sub: (t && t.branch) || "its worktree", tid: t ? t.id : undefined };
}

/** Where a file the viewer opened sits in a scope: its path inside it, or null when it's elsewhere. */
export function localIn(scope, f) {
  if (!scope || !scope.project || !f || f.project !== scope.project || !f.rel) return null;
  const rel = String(f.rel);
  if (scope.base) return rel.startsWith(scope.base + "/") ? rel.slice(scope.base.length + 1) : null;
  return rel.startsWith(".xo/") ? null : rel;
}

export function createFiles({ world, viewer, isBusy, PROJ, go, changes = null, onFold = null }) {
  const F = {
    host: null, view: "home", scope: { key: "all" }, pick: null, shown: false,
    dirs: new Map(),     // "<project>|<api path>" → {state, dirs, files, error, v (new with every change)}
    open: new Map(),     // scope key → Set of open folders (paths inside the scope)
    sel: null,           // the file shown, inside the scope (null: none, or one from elsewhere)
    fileView: false,     // narrow: the file is in front of the tree
    auto: false,         // the README was opened by us, not by you
    follow: null,        // the folder of a file opened from elsewhere (Artifacts, another thread): shown until you leave
    viewKey: "all",      // the scope the view itself gives
    q: "", wide: false,
    folded: false,       // beside a file, the tree folded to its rail (◧, ⌘B; js/filesview.js decides when)
  };
  const setOf = (k) => { if (!F.open.has(k)) F.open.set(k, new Set()); return F.open.get(k); };
  const apiRel = (s, local) => (s.base ? (local ? `${s.base}/${local}` : s.base) : local);
  const dkey = (s, local) => `${s.project}|${apiRel(s, local)}`;
  let VER = 0;

  // ── reading a folder ──────────────────────────────────────────────────────
  async function load(s, local, { again = false } = {}) {
    const k = dkey(s, local);
    const had = F.dirs.get(k);
    if (had && (had.state === "loading" || (had.state === "ok" && !again))) return had;
    F.dirs.set(k, { ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading", v: ++VER });
    try {
      const d = await api.projectTree(s.project, apiRel(s, local));
      const strip = (e) => { let p = String(e.relative_path || e.name); if (s.base && p.startsWith(s.base + "/")) p = p.slice(s.base.length + 1); return { name: e.name, path: p, bytes: e.size_bytes ?? null, at: Date.parse(e.modified_at) || 0 }; };
      F.dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip), v: ++VER });
    } catch (err) {
      F.dirs.set(k, { state: "error", error: err.status === 404 ? "Not there any more" : "Couldn't read it", v: ++VER });
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
        const at = { path: x.path, local, project: s.project, rel: f.base ? `${f.base}/${x.path}` : x.path, mark: x.mark, live: x.live, seq: x.seq, who: t.title, tid: t.id, busy: isBusy(t) };
        const prev = out.get(x.path);
        if (!prev || (at.live && !prev.live) || (at.busy && !prev.busy)) out.set(x.path, at);
      }
    }
    return [...out.values()].sort((a, b) => (b.live - a.live) || (b.busy - a.busy) || b.seq - a.seq);
  }
  const markOf = (x) => (x.live ? "live" : x.mark);
  const dot = (x, words = false) => `<span class="fl-who w-${markOf(x)}"${words ? "" : ` title="${esc(`${x.live ? "Being edited now" : MARK_WORD[x.mark] || x.mark} by ${x.who}`)}"`}><i></i>${words ? esc(x.live ? "editing now" : MARK_WORD[x.mark] || "") : ""}</span>`;

  // ── drawing ───────────────────────────────────────────────────────────────
  // The tree is drawn a folder at a time. Each open folder's rows sit in their own group (div.fl-g) right
  // after its row, and a group is redrawn only when what it shows changes: the folder was read again, or an
  // agent's mark in it changed. Opening or closing a folder adds or removes just its group (a closed folder
  // keeps its group, to come back as it was), and the file shown is marked in place. So a click no longer
  // redraws thousands of rows, and keyboard focus stays where it was. A new place or a new search changes
  // every folder's rows, so those draw the whole tree in one go.
  const T = { key: null, groups: new Map(), on: null, q: null, changed: 0 }; // groups: folder → {el, sig, open (child groups drawn)}

  /** What agents touched, as marks: by file, by folder (the newest, or one being edited), and per folder a
   *  signature of the marks on its own rows. */
  function marksOf(tl) {
    const files = new Map(), dirs = new Map(), sig = new Map();
    for (const x of tl) {
      if (x.local == null) continue;
      files.set(x.local, x);
      for (let p = parentOf(x.local); p; p = parentOf(p)) if (!dirs.has(p) || x.live) dirs.set(p, markOf(x));
    }
    const add = (p, v) => sig.set(p, (sig.get(p) || "") + v + "\n");
    for (const [p, x] of files) add(parentOf(p), `${p}:${markOf(x)}:${x.who}`);
    for (const [p, m] of dirs) add(parentOf(p), `${p}/:${m}`);
    return { files, dirs, sig };
  }

  /** One folder's own rows (those the search finds, and open folders). An open folder inside it gets a
   *  group: empty, for sync to fill, or with inner(path)'s rows when the whole tree is drawn at once. */
  function rowsHtml(s, local, d, marks, q, inner = null) {
    const depth = local ? local.split("/").length : 0;
    if (!d || (d.state === "loading" && !d.dirs)) return `<p class="fl-note" style="--d:${depth}"><i class="spin" aria-hidden="true"></i>Reading…</p>`;
    if (d.state === "error") return `<p class="fl-note is-err" style="--d:${depth}">${esc(d.error)} <button type="button" class="fl-link" data-fl-retry="${esc(local)}">Try again</button></p>`;
    const open = setOf(s.key);
    let h = "";
    for (const x of d.dirs) {
      const on = open.has(x.path);
      if (q && !x.name.toLowerCase().includes(q) && !on) continue;
      h += `<button type="button" class="fl-r is-dir${on ? " is-open" : ""}" style="--d:${depth}" data-fl-dir="${esc(x.path)}" aria-expanded="${on}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(x.name)}</span>${marks.dirs.has(x.path) ? `<span class="fl-who w-${marks.dirs.get(x.path)}"><i></i></span>` : ""}</button>`;
      if (on) h += `<div class="fl-g" data-fl-g="${esc(x.path)}">${inner ? inner(x.path) : ""}</div>`;
    }
    for (const x of d.files) {
      if (q && !x.name.toLowerCase().includes(q)) continue;
      const m = marks.files.get(x.path);
      h += `<button type="button" class="fl-r" style="--d:${depth}" data-fl-file="${esc(x.path)}" data-fl-bytes="${x.bytes ?? ""}" title="${esc(x.path)}"><span class="fl-c fl-i">${fileIcon(x.name)}</span><span class="fl-n">${esc(x.name)}</span>${m ? dot(m) : ""}<span class="fl-sz">${esc(size(x.bytes))}</span></button>`;
    }
    if (!d.dirs.length && !d.files.length) h += `<p class="fl-note" style="--d:${depth}">Empty</p>`;
    return h;
  }

  /** A folder's row, opened or closed in place. */
  function flip(el, p, on) {
    const b = el.querySelector(`:scope > [data-fl-dir="${CSS.escape(p)}"]`);
    if (b) { b.classList.toggle("is-open", on); b.setAttribute("aria-expanded", String(on)); }
    return b;
  }
  const group = (p) => {
    let g = T.groups.get(p);
    if (!g) { const el = document.createElement("div"); el.className = "fl-g"; el.dataset.flG = p; T.groups.set(p, g = { el, sig: null, open: new Set() }); }
    return g;
  };

  /** What a folder's own rows show: its read, the marks on them, the search, and (while searching, when an
   *  open folder shows even if its name doesn't match) which folders in it are open. */
  const sigOf = (d, local, ctx) => `${d ? d.v : 0}|${ctx.marks.sig.get(local) || ""}|${ctx.q}|${ctx.q ? (ctx.openIn.get(local) || []).join("\n") : ""}`;
  /** The row that had focus, found again after its rows were drawn anew. */
  function refocus(had, root) {
    if (!had) return;
    if (had.isConnected) { had.focus({ preventScroll: true }); return; }
    const k = had.dataset.flDir != null ? `[data-fl-dir="${CSS.escape(had.dataset.flDir)}"]` : had.dataset.flFile != null ? `[data-fl-file="${CSS.escape(had.dataset.flFile)}"]` : null;
    (k && root.querySelector(k))?.focus({ preventScroll: true });
  }

  /** The whole tree in one go: on a new place, and when the search changes (every folder's rows do). */
  function drawAll(s, ctx) {
    const root = T.groups.get("").el, made = new Map();
    const a = document.activeElement, had = a && root.contains(a) ? a : null;
    const inner = (p) => {
      const d = F.dirs.get(dkey(s, p)), g = { el: null, sig: sigOf(d, p, ctx), open: new Set() };
      made.set(p, g);
      return rowsHtml(s, p, d, ctx.marks, ctx.q, (c) => { g.open.add(c); return inner(c); });
    };
    root.innerHTML = inner("");
    made.get("").el = root;
    for (const el of root.querySelectorAll(".fl-g")) made.get(el.dataset.flG).el = el;
    T.groups = made;
    refocus(had, root);
  }

  /** Bring a folder's group up to date, then the open folders inside it. */
  function sync(s, local, g, ctx) {
    const d = F.dirs.get(dkey(s, local));
    const sig = sigOf(d, local, ctx);
    if (g.sig !== sig) {
      const a = document.activeElement, had = a && g.el.contains(a) ? a : null;
      g.el.innerHTML = rowsHtml(s, local, d, ctx.marks, ctx.q);
      g.sig = sig; g.open.clear();
      for (const ph of g.el.querySelectorAll(":scope > .fl-g")) {
        const c = T.groups.get(ph.dataset.flG);
        if (c) ph.replaceWith(c.el); else T.groups.set(ph.dataset.flG, { el: ph, sig: null, open: new Set() });
        g.open.add(ph.dataset.flG);
      }
      refocus(had, g.el);
    } else {
      const open = ctx.open;
      for (const p of g.open) if (!open.has(p)) { flip(g.el, p, false); T.groups.get(p).el.remove(); g.open.delete(p); }
      for (const p of ctx.openIn.get(local) || []) {
        if (g.open.has(p)) continue;
        const b = flip(g.el, p, true);
        if (b) { b.after(group(p).el); g.open.add(p); }
      }
    }
    for (const p of g.open) sync(s, p, T.groups.get(p), ctx);
  }

  function headHtml(s) {
    return `<div class="fl-crumb">${F.pick || (F.follow && F.viewKey === "all") ? `<button type="button" class="fl-up" data-fl-unpick title="Your projects">${BACK}</button>` : ""}<b>${esc(s.label)}</b>${s.sub ? `<small title="${s.base ? "A thread's own worktree: its branch" : ""}">${esc(s.sub)}</small>` : ""}</div>` +
      `<label class="fl-q"><span class="sr-only">Find a file</span>${ICON.search}<input data-fl-q placeholder="Find a loaded file" autocomplete="off" spellcheck="false"></label>`;
  }
  /** Above the tree: what this place changed (Space's /changes), every file with its counts, each opening on
   *  its diff; where Space can't say, what agents touched (from the turns). Where Space says nothing changed,
   *  nothing: the panel's Changes says the same, and the turns' marks aren't the place's state. */
  function secHtml(s, tl) {
    const cs = changes && s.key === F.viewKey ? changes.of(F.view) : null;
    if (cs && cs.state === "ok" && !cs.files.size) return "";
    if (cs && cs.state === "ok") {
      const live = changes.activity(F.view).live;
      return `<p class="fl-sec">Changed ${s.base ? "in this thread" : "here"}</p>` + [...cs.files.values()].map((f) => {
        const rel = s.base ? `${s.base}/${f.path}` : f.path, on = viewer.hasFile && viewer.file && viewer.file.rel === rel && viewer.file.show === "changes";
        return `<button type="button" class="fl-r is-touch${on ? " is-on" : ""}" style="--d:0" data-fl-change="${esc(rel)}" title="${esc(f.path)}"><span class="fl-c fl-i">${fileIcon(f.path)}</span><span class="fl-n">${esc(f.path)}</span>${live.has(f.path) ? `<span class="fl-who w-live"><i></i>editing now</span>` : f.binary ? "" : countsHtml(f)}</button>`;
      }).join("") + `<p class="fl-sec">All files</p>`;
    }
    const top = tl.slice(0, TOUCHED);
    return top.length ? `<p class="fl-sec">Touched by agents</p>` + top.map((x) => `<button type="button" class="fl-r is-touch" style="--d:0" data-fl-touch="${esc(x.rel)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="fl-c fl-i">${fileIcon(x.path)}</span><span class="fl-n">${esc(x.path)}</span>${dot(x, true)}</button>`).join("") + `<p class="fl-sec">All files</p>` : "";
  }
  const pickHtml = () => `<div class="fl-head"><div class="fl-crumb"><b>Projects</b></div></div><div class="fl-list">` +
    (world.state.projects || []).filter((p) => p && p.id !== "workspace").map((p) => `<button type="button" class="fl-r is-dir" style="--d:0" data-fl-pick="${esc(p.id)}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(p.name || p.id)}</span>${world.state.threads.some((t) => t.project === p.id && isBusy(t)) ? `<span class="fl-who w-live" title="Agents at work"><i></i></span>` : ""}</button>`).join("") + `</div>`;
  const put = (node, html) => { if (node._h !== html) { node.innerHTML = html; node._h = html; return true; } return false; };

  function paintTree(s, tree) {
    if (s.key === "all") {
      if (T.key !== "all") { T.key = "all"; T.groups = new Map(); T.on = null; tree._h = null; }
      put(tree, pickHtml());
      return;
    }
    if (T.key !== s.key || !tree.firstElementChild) {
      tree.innerHTML = `<div class="fl-head"></div><div class="fl-list"><div class="fl-secs"></div><div class="fl-g" data-fl-g=""></div></div>`;
      tree._h = null; T.key = s.key; T.on = null; T.q = null;
      T.groups = new Map([["", { el: tree.querySelector(".fl-list > .fl-g"), sig: null, open: new Set() }]]);
      requestAnimationFrame(fitList);
    }
    const head = tree.querySelector(".fl-head");
    const qi = head.querySelector("[data-fl-q]"), typing = qi && document.activeElement === qi ? [qi.selectionStart, qi.selectionEnd] : null;
    if (put(head, headHtml(s)) && typing) { const q2 = head.querySelector("[data-fl-q]"); q2.value = F.q; q2.focus(); q2.setSelectionRange(...typing); }
    const q = head.querySelector("[data-fl-q]");
    if (q.value !== F.q) q.value = F.q;
    const tl = touched(s);
    const cs = changes && s.key === F.viewKey ? changes.of(F.view) : null;
    T.changed = cs && cs.state === "ok" ? cs.files.size : tl.length;
    put(tree.querySelector(".fl-secs"), secHtml(s, tl));
    const open = setOf(s.key), openIn = new Map();
    for (const p of open) { const at = parentOf(p); if (!openIn.has(at)) openIn.set(at, []); openIn.get(at).push(p); }
    const ctx = { marks: marksOf(tl), open, openIn, q: F.q.trim().toLowerCase() };
    if (T.q !== ctx.q) { drawAll(s, ctx); T.q = ctx.q; } else sync(s, "", T.groups.get(""), ctx);
    // the file shown, marked in its folder's group
    const g = F.sel != null ? T.groups.get(parentOf(F.sel)) : null;
    const want = g ? g.el.querySelector(`:scope > [data-fl-file="${CSS.escape(F.sel)}"]`) : null;
    if (T.on !== want) T.on?.classList.remove("is-on");
    want?.classList.add("is-on");
    T.on = want;
  }

  function paint() {
    if (!F.host || !F.shown) return;
    const s = F.scope;
    paintTree(s, F.host.querySelector(".fl-tree"));
    const has = viewer.hasFile;
    const lay = F.host.querySelector(".fl");
    lay.classList.toggle("is-wide", F.wide);
    lay.classList.toggle("is-folded", F.folded && F.wide && has);
    // the folded tree's Changed: a mark when this place changed something; how many is in its title
    const n = s.key === "all" ? 0 : T.changed;
    const rb = lay.querySelector('[data-fl-rail="changes"]');
    rb.title = n ? `Changed ${s.base ? "in this thread" : "here"}: ${n.toLocaleString()} file${n === 1 ? "" : "s"}` : "Changed here: nothing yet";
    rb.querySelector("em").hidden = !n;
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
    // a file from outside this folder: the tree goes to its folder, so it can be found and highlighted
    if (localIn(F.scope, f) == null) {
      const fs = fileScope(f, { threads: world.state.threads, project: (id) => PROJ(id) });
      if (fs && localIn(fs, f) != null) { F.follow = fs; setScope(F.view); }
    }
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
    if (view !== F.view) F.follow = null;
    F.view = view;
    let s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
    F.viewKey = s.key;
    if (F.follow) s = F.follow;
    else if (s.key === "all" && F.pick) s = { key: `${F.pick}|`, project: F.pick, base: "", label: PROJ(F.pick), sub: "" };
    if (s.key !== F.scope.key) {
      F.scope = s; F.q = ""; F.sel = null;
      if (s.project) load(s, "");
      return true;
    }
    F.scope = s;
    return false;
  }

  /** Whole rows: the list is a whole number of its 28 px rows tall (headings are 28 too), and it snaps to
   *  them, so the last row on screen is never cut (Astra, 5 Nov). */
  function fitList() {
    const tree = F.host && F.host.querySelector(".fl-tree"), list = tree && tree.querySelector(".fl-list");
    if (!list) return;
    const head = tree.querySelector(".fl-head"), room = tree.clientHeight - (head ? head.offsetHeight : 0);
    const h = room > 0 ? Math.floor(room / ROW) * ROW : 0;
    const px = h ? `${h}px` : "";
    if (list.style.maxHeight !== px) list.style.maxHeight = px;
  }

  // ── folded to a rail (beside a file) ─────────────────────────────────────
  /** Fold or open the tree; `onFold` (js/filesview.js) hears it when it was you. */
  function fold(on, { mine = false } = {}) {
    if (F.folded === !!on) return;
    F.folded = !!on;
    paint();
    if (mine && onFold) onFold(F.folded);
  }
  /** A rail icon: the tree opens on that section (Changed, All files, or Find with its field focused). */
  function unfoldTo(part) {
    fold(false, { mine: true });
    const tree = F.host.querySelector(".fl-tree"), list = tree.querySelector(".fl-list");
    if (part === "find") { tree.querySelector("[data-fl-q]")?.focus(); return; }
    const secs = [...tree.querySelectorAll(".fl-sec")];
    const at = part === "all" ? secs.find((x) => /^All files/.test(x.textContent)) : secs[0];
    if (list) list.scrollTop = at && part === "all" ? at.offsetTop - list.offsetTop : 0;
    (part === "all" ? tree.querySelector(".fl-g .fl-r") : tree.querySelector(".fl-secs .fl-r") || tree.querySelector(".fl-r"))?.focus({ preventScroll: true });
  }

  // ── input ─────────────────────────────────────────────────────────────────
  function wire(host) {
    host.addEventListener("click", (e) => {
      const t = e.target;
      const rl = t.closest("[data-fl-rail]");
      if (rl) { unfoldTo(rl.dataset.flRail); return; }
      const dirB = t.closest("[data-fl-dir]");
      if (dirB) {
        const p = dirB.dataset.flDir, open = setOf(F.scope.key);
        if (open.has(p)) open.delete(p); else { open.add(p); load(F.scope, p); }
        paint(); return;
      }
      const fb = t.closest("[data-fl-file]");
      if (fb) { openFile(F.scope, fb.dataset.flFile, fb, fb.dataset.flBytes === "" ? null : Number(fb.dataset.flBytes)); return; }
      const cg = t.closest("[data-fl-change]");
      if (cg) {
        const rel = cg.dataset.flChange, s = F.scope;
        F.fileView = true; F.auto = false; F.sel = null;
        viewer.open({ path: rel, name: base(rel), project: s.project, rel, show: "changes" }, cg); paint(); return;
      }
      const tc = t.closest("[data-fl-touch]");
      if (tc) {
        const rel = tc.dataset.flTouch, s = F.scope;
        F.fileView = true; F.auto = false; F.sel = localIn(s, { project: s.project, rel });
        viewer.open({ path: rel, name: base(rel), project: s.project, rel }, tc); return;
      }
      const pk = t.closest("[data-fl-pick]");
      if (pk) { F.pick = pk.dataset.flPick; F.follow = null; setScope(F.view); paint(); frontPage(); return; }
      if (t.closest("[data-fl-unpick]")) { F.pick = null; F.follow = null; viewer.close({ restore: false }); setScope(F.view); paint(); return; }
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
    // the list's whole rows follow the tree's own height (it shows, folds, or the window changes)
    if (typeof ResizeObserver === "function") new ResizeObserver(() => fitList()).observe(host.querySelector(".fl-tree"));
    // a scroll that ends between rows settles on the nearest one (every row, heading and note is 28 px)
    let settleT = 0;
    const settle = (e) => {
      const l = e.target;
      if (!l.classList || !l.classList.contains("fl-list")) return;
      const t = Math.round(l.scrollTop / ROW) * ROW;
      if (Math.abs(t - l.scrollTop) >= 1 && t <= l.scrollHeight - l.clientHeight) l.scrollTo({ top: t, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    if ("onscrollend" in window) host.addEventListener("scrollend", settle, true);
    else host.addEventListener("scroll", (e) => { clearTimeout(settleT); settleT = setTimeout(() => settle(e), 160); }, true);
  }

  return {
    /** Once: draw inside the Files tab; the viewer moves in beside the tree. */
    mount(host) {
      F.host = host;
      host.innerHTML = `<div class="fl"><nav class="fl-rail" aria-label="Files, folded"><button type="button" class="fl-rb" data-fl-rail="changes">${CHANGED_IC}<em hidden></em></button><button type="button" class="fl-rb" data-fl-rail="all" title="All files">${FOLDER_IC}</button><button type="button" class="fl-rb" data-fl-rail="find" title="Find a file">${ICON.search}</button></nav>` +
        `<div class="fl-tree"></div><div class="fl-split" role="separator" aria-orientation="vertical" aria-label="Resize the file tree" title="Drag to resize · double-click for the default" tabindex="0"></div><div class="fl-pv"><div class="fl-bar"></div><div class="fl-view"></div><p class="fl-empty">Pick a file to read it here.</p></div></div>`;
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
    /** What agents changed in a view's scope (newest first): {path, rel, project, mark, live, who, tid}. */
    changes(view) {
      const s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
      return s.project ? touched(s) : [];
    },
    /** Beside a file: fold the tree to its rail, or open it (mine: you did, so it's kept). */
    fold,
    /** One at a time (a phone): the list in front of the file, or the file again; the file stays open. */
    list(on) { if (F.wide || !viewer.hasFile) return false; F.fileView = !on; paint(); return true; },
    get listing() { return !F.wide && viewer.hasFile && !F.fileView; },
    get folded() { return F.folded; },
    /** The file came from you (a click), not from the front page: the panel treats it as yours. */
    get auto() { return F.auto; },
    /** The folder on screen ({label, sub}), or null when it's the list of projects. */
    get place() { return F.shown && F.scope.project ? { label: F.scope.label, sub: F.scope.sub || "" } : null; },
  };
}
