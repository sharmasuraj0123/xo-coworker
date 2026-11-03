// The Map: where your agents are working, beside the conversation. One button (top right of every
// conversation, ⌘\) opens it; it follows the view you're on and zooms with you:
//   · a thread: what its agent is doing right now, and its folder (its own worktree) as a tree. The file
//     being read or edited glows and the tree follows it. "Touched" shows only what its recent turns
//     created, edited or read; "All files" is the whole folder, read a level at a time.
//   · a project: the agents working in it now, and the project's folder with a dot wherever one is.
//   · Home, the Workspace, Chats: every agent working right now, by project.
// The Map and the file viewer are one right-hand panel with two modes, Live and File: a file opened
// from the tree (or anywhere) shows as File, with a Live · File switch on top; Live parks the file and
// File brings it back as it was; closing the file returns to Live. The Needs you panel takes the right
// side while it is open and gives it back after. On a phone it is a full sheet.
//
// What it reads: the turns the stream already brings (storm's activity rows: kind, target, status),
// and GET /api/xo-projects/<project>/tree (one level per call; it serves a thread's worktree under
// `.xo/worktrees/<name>` too). Nothing here writes.

import { esc } from "./world.js";
import { ICON, $, elapsed } from "./ui.js";
import { api } from "./api.js";
import { renderInline } from "./markdown.js";
import { isImagePath } from "./util.js";

const KEY = "cv-map";
const FILE_KINDS = new Set(["create_file", "edit_file", "delete_file", "read"]);
const VERB_NOW = { create_file: "Writing", edit_file: "Editing", delete_file: "Deleting", read: "Reading" };
const CAP = 400; // rows a folder shows before "N more"
const QUIET_MS = 6000; // after you scroll or click in the tree, it stops following for this long

export const MAP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15M17 8.5h1M17 11.5h1M17 14.5h1"/></svg>';
const DIR_OPEN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 18V7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h7A1.5 1.5 0 0 1 19.5 9v1.5"/><path d="M3.5 18l2.3-6.4a1.5 1.5 0 0 1 1.4-1h13.3l-2.4 7.4H3.5z"/></svg>';

const base = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();
const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
const ancestors = (p) => { const out = []; let d = parentOf(p); while (d) { out.unshift(d); d = parentOf(d); } return out; };

/** A thread's folder: its absolute root and, inside the project, the relative base the tree route takes. */
export function folderOf(t) {
  if (!t || !t.project) return null;
  const wt = String(t.worktree || "").replace(/\/+$/, "");
  if (wt) {
    const i = wt.indexOf("/.xo/worktrees/");
    const sub = i < 0 ? "" : wt.slice(i + 1);
    return /^\.xo\/worktrees\/[^/]+$/.test(sub) ? { root: wt, base: sub, project: t.project, projectRoot: wt.slice(0, i) } : null;
  }
  const cwd = String(t.cwd || "").replace(/\/+$/, "");
  return cwd && cwd.split("/").pop() === t.project ? { root: cwd, base: "", project: t.project, projectRoot: cwd } : null;
}

/** A row's target, relative to `root` ({rel}), or outside it ({abs}). */
export function placeOf(root, target) {
  let p = String(target || "").replace(/\\/g, "/");
  if (!p) return null;
  if (p.startsWith("/")) {
    if (root && p.startsWith(root + "/")) p = p.slice(root.length + 1);
    else return { abs: p };
  }
  p = p.replace(/^(\.\/)+/, "");
  if (!p || p.split("/").some((s) => s === ".." || s === "")) return { abs: target };
  return { rel: p };
}

/**
 * What a session's loaded turns did, from storm's activity rows. Pure: `turns` is the turn store.
 * → {files: Map rel → F, outside: Map abs → F, now: {row, turn} | null, last, running}
 * F = {path, mark: "new" | "edited" | "deleted" | "read", live, waiting, verb}
 */
export function activityOf(turns, session, root) {
  const out = { files: new Map(), outside: new Map(), now: null, last: null, running: null };
  if (!turns || !session) return out;
  let n = 0;
  for (const tu of turns.list((x) => x.session === session)) {
    const live = tu.status === "running";
    if (live) out.running = tu;
    for (const b of turns.blocksOf(tu)) {
      if (b.type !== "activity") continue;
      for (const r of b.rows || []) {
        n++;
        if (r.kind === "notice" || r.kind === "error") continue;
        const on = live && r.status === "running";
        out.last = { row: r, turn: tu };
        if (on) out.now = { row: r, turn: tu };
        if (!FILE_KINDS.has(r.kind) || !r.target || r.status === "error" || r.status === "denied" || r.status === "cancelled") continue;
        const pl = placeOf(root, r.target);
        if (!pl) continue;
        const into = pl.rel != null ? out.files : out.outside;
        const key = pl.rel ?? pl.abs;
        const f = into.get(key) || { path: key, kinds: new Set(), seq: 0 };
        f.kinds.add(r.kind);
        f.lastKind = r.kind;
        f.seq = n;
        f.live = on;
        f.waiting = on && !!r.waiting;
        f.verb = VERB_NOW[r.kind];
        into.set(key, f);
      }
    }
  }
  for (const m of [out.files, out.outside]) for (const f of m.values()) {
    f.mark = f.lastKind === "delete_file" ? "deleted" : f.kinds.has("create_file") ? "new" : f.kinds.has("edit_file") ? "edited" : "read";
  }
  return out;
}

/** Paths → a nested tree; a folder with one folder and no files folds into it ("js/shells"). */
export function treeOf(paths) {
  const root = { name: "", path: "", dirs: new Map(), files: [] };
  for (const f of paths) {
    const segs = f.path.split("/");
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const p = segs.slice(0, i + 1).join("/");
      if (!node.dirs.has(segs[i])) node.dirs.set(segs[i], { name: segs[i], path: p, dirs: new Map(), files: [] });
      node = node.dirs.get(segs[i]);
    }
    node.files.push({ ...f, name: segs[segs.length - 1] });
  }
  const fold = (d) => {
    for (const [k, c] of d.dirs) {
      let x = c;
      while (x.files.length === 0 && x.dirs.size === 1) { const only = [...x.dirs.values()][0]; x = { ...only, name: `${x.name}/${only.name}` }; }
      d.dirs.set(k, x);
      fold(x);
    }
  };
  fold(root);
  return root;
}

export function createMap({ world, viewer, go, announce, isBusy, onChange }) {
  const el = $("#map");
  let saved = false;
  try { saved = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }
  const M = {
    open: saved, view: "home", mode: "touched", // thread scope: "touched" | "all"
    dirs: new Map(),      // "<project>|<api rel>" → {state: "loading"|"ok"|"error", dirs, files, error}
    expanded: new Map(),  // scope key → Set of local folder paths open in "All files"
    followed: new Map(),  // scope key → the live path the tree last revealed
    quietUntil: 0,
    html: "",
  };

  // ── what's in scope ─────────────────────────────────────────────────────────
  function scopeOf(v) {
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) return { kind: "thread", t, key: v, fold: folderOf(t) }; }
    if (v.startsWith("p:")) return { kind: "project", pid: v.slice(2), key: v };
    return { kind: "all", key: "all" };
  }
  const turns = () => world.state.turns || null;

  /** One agent at work: a thread, or a project's coordinator. → {id, title, go, project, now, live file, waiting, since} */
  function agentOf(t) {
    const fold = folderOf(t);
    const a = activityOf(turns(), t.sessionId, fold && fold.root);
    const now = a.now && a.now.row;
    const liveFile = [...a.files.values()].find((f) => f.live) || null;
    return { id: t.id, title: t.title, go: "t:" + t.id, project: t.project, fold, act: a, now, liveFile, waiting: !!(now && now.waiting), since: a.running ? Date.parse(a.running.at) : null };
  }
  function coordinatorOf(pid) {
    const sid = world.act.coordinatorBusy && world.act.coordinatorBusy(pid);
    if (!sid) return null;
    const anyT = world.state.threads.find((x) => x.project === pid && folderOf(x));
    const root = anyT ? folderOf(anyT).projectRoot : null;
    const a = activityOf(turns(), sid, root);
    const now = a.now && a.now.row;
    return { id: "coord:" + pid, title: "Coordinator", go: pid === "workspace" ? "ws" : "p:" + pid, project: pid, fold: root ? { root, base: "", project: pid } : null, act: a, now, liveFile: [...a.files.values()].find((f) => f.live) || null, waiting: !!(now && now.waiting), since: a.running ? Date.parse(a.running.at) : null, coord: true };
  }
  function agentsIn(pid) {
    const ts = world.state.threads.filter((t) => (!pid || t.project === pid) && isBusy(t));
    const out = ts.map(agentOf);
    const pids = pid ? [pid] : [...new Set(world.state.projects.map((p) => p.id))];
    for (const p of pids) { const c = coordinatorOf(p); if (c) out.unshift(c); }
    return out;
  }

  // ── lines ──────────────────────────────────────────────────────────────────
  /** What an agent is doing, in one line: its running step, else what its turn is on. */
  function doingLine(ag) {
    if (ag.now) return renderInline(ag.now.line || ag.now.tool || "Working", true);
    if (ag.act.running) {
      const bl = turns().blocksOf(ag.act.running);
      const last = bl[bl.length - 1];
      return esc(last ? (last.type === "thinking" ? "Thinking" : last.type === "text" || last.type === "answer" ? "Writing its reply" : String(last.header || "Working").replace(/`/g, "")) : "Starting");
    }
    return "Working";
  }
  const since = (ms) => (Number.isFinite(ms) ? `<span class="elapsed" data-since="${ms}"></span>` : "");

  // ── the tree, read a level at a time ─────────────────────────────────────────
  const apiRel = (fold, local) => (fold.base ? (local ? `${fold.base}/${local}` : fold.base) : local);
  const dirKey = (fold, local) => `${fold.project}|${apiRel(fold, local)}`;
  async function load(fold, local, { again = false } = {}) {
    const k = dirKey(fold, local);
    const had = M.dirs.get(k);
    if (had && (had.state === "loading" || ((had.state === "ok" || had.state === "error") && !again))) return;
    M.dirs.set(k, { ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading", refreshing: true });
    try {
      const d = await api.projectTree(fold.project, apiRel(fold, local));
      const strip = (e) => { let p = String(e.relative_path || e.name); if (fold.base && p.startsWith(fold.base + "/")) p = p.slice(fold.base.length + 1); return { name: e.name, path: p, size: e.size_bytes, entries: e.entries }; };
      M.dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip) });
    } catch (err) {
      M.dirs.set(k, { state: "error", error: err.status === 404 ? "This folder isn't there any more." : err.message || "Couldn't read this folder." });
    }
    paint();
  }
  const expandedOf = (key) => { if (!M.expanded.has(key)) M.expanded.set(key, new Set()); return M.expanded.get(key); };

  /** Open the folders down to `path` (and read them), so the row is on screen. */
  function reveal(scope, fold, path) {
    const ex = expandedOf(scope.key);
    for (const d of ancestors(path)) { ex.add(d); load(fold, d); }
  }

  // ── rows ───────────────────────────────────────────────────────────────────
  const MARK_WORD = { new: "new", edited: "edited", deleted: "deleted", read: "" };
  function fileRow(f, depth, { presence = [], openable = true } = {}) {
    const live = f.live || presence.length;
    const mark = f.mark ? MARK_WORD[f.mark] : "";
    const tail = f.live ? `<span class="mp-live${f.waiting ? " is-wait" : ""}">${esc(f.waiting ? "waiting" : (f.verb || "working").toLowerCase())}</span>`
      : presence.length ? `<span class="mp-who" title="${esc(presence.map((a) => a.title).join(", "))}">${presence.length > 1 ? presence.length : ""}<i></i></span>`
      : mark ? `<span class="mp-mk">${mark}</span>` : "";
    const cls = `mp-r is-file${f.mark ? ` m-${f.mark}` : ""}${live ? " is-live" : ""}`;
    const ic = isImagePath(f.path) ? ICON.image : ICON.doc;
    const inner = `<span class="mp-ic">${ic}</span><span class="mp-n">${esc(f.name)}</span>${tail}`;
    if (!openable || f.mark === "deleted") return `<li><div class="${cls}" style="--d:${depth}" title="${esc(f.path)}">${inner}</div></li>`;
    return `<li><button type="button" class="${cls}" style="--d:${depth}" data-mp-file="${esc(f.path)}" data-fid="mpf:${esc(f.path)}" title="${esc(f.path)}">${inner}</button></li>`;
  }

  /** "Touched": only what this thread's turns created, edited or read; folders always open. */
  function touchedHtml(files) {
    const tree = treeOf([...files.values()]);
    const walk = (d, depth) => {
      let h = "";
      for (const c of [...d.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        h += `<li><div class="mp-r is-dir is-open" style="--d:${depth}"><span class="mp-ic">${DIR_OPEN}</span><span class="mp-n">${esc(c.name)}</span></div></li>`;
        h += walk(c, depth + 1);
      }
      for (const f of d.files.sort((a, b) => a.name.localeCompare(b.name))) h += fileRow(f, depth);
      return h;
    };
    return `<ul class="mp-tree" role="list">${walk(tree, 0)}</ul>`;
  }

  /** "All files": the folder as it is on disk, with what agents did and where they are marked. */
  function allHtml(scope, fold, marks, presence) {
    const ex = expandedOf(scope.key);
    const here = (local) => M.dirs.get(dirKey(fold, local));
    const presIn = (dir) => { let n = 0; for (const [p, who] of presence) if (p.startsWith(dir + "/")) n += who.length; return n; };
    const touchedIn = (dir) => { for (const p of marks.keys()) if (p.startsWith(dir + "/")) return true; return false; };
    const walk = (local, depth) => {
      const d = here(local);
      if (!d || (d.state === "loading" && !d.dirs)) return `<li><p class="mp-note" style="--d:${depth}"><i class="spin" aria-hidden="true"></i>Reading…</p></li>`;
      if (d.state === "error") return `<li><p class="mp-note is-err" style="--d:${depth}">${esc(d.error)} <button type="button" class="mp-link" data-mp-retry="${esc(local)}">Try again</button></p></li>`;
      let h = "", shown = 0;
      const total = d.dirs.length + d.files.length;
      for (const c of d.dirs) {
        if (shown++ >= CAP) break;
        const open = ex.has(c.path);
        const n = presIn(c.path);
        const dot = !open && n ? `<span class="mp-who" title="${n} working in here">${n > 1 ? n : ""}<i></i></span>` : !open && touchedIn(c.path) ? `<span class="mp-mk is-dot" title="Changed in here"></span>` : "";
        h += `<li><button type="button" class="mp-r is-dir${open ? " is-open" : ""}" style="--d:${depth}" data-mp-dir="${esc(c.path)}" data-fid="mpd:${esc(c.path)}" aria-expanded="${open}"><span class="mp-ch">${ICON.chevron}</span><span class="mp-ic">${open ? DIR_OPEN : ICON.folder}</span><span class="mp-n">${esc(c.name)}</span>${dot}</button></li>`;
        if (open) h += walk(c.path, depth + 1);
      }
      for (const f of d.files) {
        if (shown++ >= CAP) break;
        const m = marks.get(f.path);
        h += fileRow({ ...f, ...(m || {}), name: f.name, path: f.path }, depth, { presence: presence.get(f.path) || [] });
      }
      if (total > CAP) h += `<li><p class="mp-note" style="--d:${depth}">${total - CAP} more not shown</p></li>`;
      if (!total) h += `<li><p class="mp-note" style="--d:${depth}">Empty</p></li>`;
      return h;
    };
    return `<ul class="mp-tree" role="list">${walk("", 0)}</ul>`;
  }

  function agentRow(ag, { showProject = false } = {}) {
    const st = ag.waiting ? "wait" : "busy";
    const file = ag.liveFile ? ` <span class="mp-af">${esc(base(ag.liveFile.path))}</span>` : "";
    const where = showProject && ag.project ? `<span class="mp-ap">${esc((world.project(ag.project) || {}).name || ag.project)}</span>` : "";
    return `<li><button type="button" class="mp-ag st-${st}" data-mp-go="${esc(ag.go)}" data-fid="mpa:${esc(ag.id)}" title="${esc(ag.coord ? "Open the conversation" : "Open the thread and follow it")}">` +
      `<span class="mp-pulse" aria-hidden="true"></span><span class="mp-at"><b>${esc(ag.title)}</b>${where}</span>` +
      `<span class="mp-ad">${ag.waiting ? "Waiting for you" : doingLine(ag)}</span>${since(ag.since)}</button></li>`;
  }

  // ── the panel ────────────────────────────────────────────────────────────────
  function head(title, sub, ic) {
    return `<header class="mp-top"><span class="mp-hic" aria-hidden="true">${ic}</span><div class="mp-t"><h2 id="mp-h">${esc(title)}</h2>${sub ? `<p class="mp-sub">${sub}</p>` : ""}</div>` +
      `<button type="button" class="mp-x" data-mp-close aria-label="Close the map" title="Close">${ICON.close}</button></header>`;
  }

  function threadBody(scope) {
    const t = scope.t, fold = scope.fold;
    const ag = agentOf(t);
    const a = ag.act;
    const busy = isBusy(t);
    // Now: one line for what it's doing, the file it's on one tap away
    let now;
    if (busy) {
      const f = ag.liveFile;
      now = `<div class="mp-now st-${ag.waiting ? "wait" : "busy"}"><span class="mp-pulse" aria-hidden="true"></span><div class="mp-nt"><p class="mp-nl">${ag.waiting ? "Waiting for you" : doingLine(ag)}</p>` +
        (f ? `<button type="button" class="mp-nf" data-mp-file="${esc(f.path)}" title="Open ${esc(f.path)}"><code>${esc(f.path)}</code></button>` : ag.now && ag.now.kind === "command" && ag.now.target && ag.now.target !== ag.now.line ? `<code class="mp-cmd">${esc(String(ag.now.target).slice(0, 160))}</code>` : "") +
        `</div>${since(ag.since)}</div>`;
    } else {
      const last = a.last && a.last.row;
      const word = t.state === "done" ? "Done" : t.state === "resolved" ? "Resolved" : t.state === "failed" ? "Stopped" : "Not working right now";
      now = `<div class="mp-now st-rest"><span class="mp-pulse" aria-hidden="true"></span><div class="mp-nt"><p class="mp-nl">${esc(word)}</p>${last ? `<p class="mp-nlast">Last: ${renderInline(last.line || last.tool || "", true)}</p>` : ""}</div></div>`;
    }
    if (!fold) return now + `<p class="mp-empty">This thread's folder isn't one XO serves to the UI, so there's no tree to show.</p>`;
    const nT = a.files.size;
    const seg = `<div class="mp-seg" role="group" aria-label="Show"><button type="button" data-mp-mode="touched" aria-pressed="${M.mode === "touched"}">Touched${nT ? `<span>${nT}</span>` : ""}</button><button type="button" data-mp-mode="all" aria-pressed="${M.mode === "all"}">All files</button></div>`;
    let tree;
    if (M.mode === "touched") {
      tree = nT ? touchedHtml(a.files) : `<p class="mp-empty">${busy ? "Nothing touched yet in this turn." : "No files touched in its recent turns."} <button type="button" class="mp-link" data-mp-mode="all">See all files</button></p>`;
    } else {
      load(fold, "");
      // follow the agent: open the folders down to the file it's on, once per file
      const live = ag.liveFile;
      if (live && M.followed.get(scope.key) !== live.path) { M.followed.set(scope.key, live.path); reveal(scope, fold, live.path); }
      tree = allHtml(scope, fold, a.files, new Map());
    }
    const outside = a.outside.size ? `<details class="mp-out"><summary>${a.outside.size} outside its folder</summary><ul>${[...a.outside.values()].map((f) => `<li title="XO only shows files inside the thread's own folder"><code>${esc(f.path)}</code>${f.mark && f.mark !== "read" ? `<span class="mp-mk">${MARK_WORD[f.mark]}</span>` : ""}</li>`).join("")}</ul></details>` : "";
    return now + seg + `<div class="mp-scroll" data-mp-scroll>${tree}${outside}</div>`;
  }

  function projectBody(scope) {
    const pid = scope.pid;
    const ags = agentsIn(pid);
    const list = ags.length ? `<ul class="mp-ags">${ags.map((a) => agentRow(a)).join("")}</ul>` : `<p class="mp-empty mp-calm">No agent is working in this project right now.</p>`;
    // the project's own folder, with a dot wherever an agent is
    const presence = new Map();
    for (const a of ags) if (a.liveFile) { const w = presence.get(a.liveFile.path) || []; w.push(a); presence.set(a.liveFile.path, w); }
    const fold = { project: pid, base: "" };
    load(fold, "");
    return `<p class="mp-lbl">Working now</p>${list}<p class="mp-lbl">Files</p><div class="mp-scroll" data-mp-scroll>${allHtml(scope, fold, new Map(), presence)}</div>`;
  }

  function allBody() {
    const ags = agentsIn(null);
    if (!ags.length) return `<div class="mp-rest"><span class="mp-hic" aria-hidden="true">${MAP_ICON}</span><p><b>No agent is working right now.</b></p><p>When one starts, it shows here with the file it's on.</p></div>`;
    const by = new Map();
    for (const a of ags) { const k = a.project || "workspace"; if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
    let h = `<div class="mp-scroll" data-mp-scroll>`;
    for (const [pid, list] of by) {
      const name = pid === "workspace" ? "Workspace" : (world.project(pid) || {}).name || pid;
      h += `<button type="button" class="mp-pj" data-mp-go="${esc(pid === "workspace" ? "ws" : "p:" + pid)}"><span class="mp-ic">${pid === "workspace" ? MAP_ICON : ICON.project}</span><b>${esc(name)}</b><span>${list.length} working</span></button><ul class="mp-ags">${list.map((a) => agentRow(a)).join("")}</ul>`;
    }
    return h + `</div>`;
  }

  function html() {
    return tabs("live") + scopeHtml();
  }

  /** The Live · File switch, on whichever mode shows; nothing unless both are there. */
  function tabs(mode) {
    if (!M.open || !viewer.hasFile) return "";
    const f = viewer.file || {};
    const name = f.name || base(f.rel || f.path) || "File";
    const live = liveIn(M.view);
    return `<nav class="stage-tabs" aria-label="Right panel"><button type="button" class="st-tab" data-stage="live" aria-pressed="${mode === "live"}" title="Where your agents are working">${MAP_ICON}<span>Live</span>${live ? `<i class="map-dot" aria-hidden="true"></i>` : ""}</button>` +
      `<span class="st-file"><button type="button" class="st-tab" data-stage="file" aria-pressed="${mode === "file"}" title="${esc(f.where || name)}">${f.image ? ICON.image : ICON.doc}<span>${esc(name)}</span></button>` +
      `<button type="button" class="st-x" data-stage="close-file" aria-label="Close ${esc(name)}" title="Close the file">${ICON.close}</button></span></nav>`;
  }

  function scopeHtml() {
    const scope = scopeOf(M.view);
    if (scope.kind === "thread") {
      const t = scope.t;
      const sub = [t.branch && `<span class="mp-br">${ICON.branch}<code>${esc(t.branch)}</code></span>`, scope.fold && scope.fold.base ? "its own worktree" : scope.fold ? "the project folder" : ""].filter(Boolean).join("<span class=\"mp-sep\">·</span>");
      return head(t.title, sub, ICON.thread) + `<div class="mp-body">${threadBody(scope)}</div>`;
    }
    if (scope.kind === "project") {
      const name = (world.project(scope.pid) || {}).name || scope.pid;
      return head(name, "Where its agents are working", ICON.project) + `<div class="mp-body">${projectBody(scope)}</div>`;
    }
    const n = agentsIn(null).length;
    return head("Working now", n ? `${n} agent${n === 1 ? "" : "s"} across your projects` : "Across your projects", MAP_ICON) + `<div class="mp-body">${allBody()}</div>`;
  }

  /** Draw only what changed, keeping the tree's scroll and focus; follow the live row unless you're browsing. */
  function paint() {
    if (!M.open || viewer.isOpen) return; // under the viewer nothing moves, so focus comes back to the row it left
    const h = html();
    if (h === M.html) return;
    const sc = el.querySelector("[data-mp-scroll]");
    const top = sc ? sc.scrollTop : 0;
    const a = document.activeElement;
    const fid = a && el.contains(a) ? a.dataset.fid : null;
    el.innerHTML = h; M.html = h;
    // the timers start right away (the app's one-second tick keeps them going)
    for (const x of el.querySelectorAll(".elapsed[data-since]")) x.textContent = elapsed(Math.max(0, Math.floor((Date.now() - +x.dataset.since) / 1000)));
    const sc2 = el.querySelector("[data-mp-scroll]");
    if (sc2) sc2.scrollTop = top;
    if (fid) el.querySelector(`[data-fid="${CSS.escape(fid)}"]`)?.focus({ preventScroll: true });
    if (Date.now() > M.quietUntil && sc2) {
      const live = sc2.querySelector(".mp-r.is-file.is-live");
      if (live) {
        const r = live.getBoundingClientRect(), b = sc2.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom) sc2.scrollTop += r.top - b.top - b.height / 3;
      }
    }
  }

  /** Is anything in this view's scope working? (the button's live dot) */
  function liveIn(v) {
    const s = scopeOf(v);
    if (s.kind === "thread") return isBusy(s.t);
    if (s.kind === "project") return world.state.threads.some((t) => t.project === s.pid && isBusy(t));
    return world.state.threads.some(isBusy);
  }

  function setOpen(on, { focus = true } = {}) {
    M.open = on;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
    document.body.classList.toggle("map-open", on);
    el.hidden = !on;
    M.html = "";
    if (on) {
      if (viewer.isOpen) viewer.park(); // one panel: Live comes forward, the file waits behind its tab
      el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in");
      paint();
      if (focus) el.focus({ preventScroll: true });
      announce("The map is open: where your agents are working.");
    } else {
      el.innerHTML = "";
      if (viewer.isParked) viewer.close({ restore: false }); // closing the panel closes all of it
      else viewer.refresh();
      announce("Map closed.");
    }
    onChange && onChange();
  }

  // ── input ──────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-mp-close]")) { close(); return; }
    const md = t.closest("[data-mp-mode]");
    if (md) { M.mode = md.dataset.mpMode; M.html = ""; paint(); return; }
    const g = t.closest("[data-mp-go]");
    if (g) { go(g.dataset.mpGo); return; }
    const scope = scopeOf(M.view);
    const fold = scope.kind === "thread" ? scope.fold : scope.kind === "project" ? { project: scope.pid, base: "" } : null;
    const rt = t.closest("[data-mp-retry]");
    if (rt && fold) { load(fold, rt.dataset.mpRetry, { again: true }); return; }
    const d = t.closest("[data-mp-dir]");
    if (d && fold) {
      M.quietUntil = Date.now() + QUIET_MS;
      const ex = expandedOf(scope.key), p = d.dataset.mpDir;
      if (ex.has(p)) ex.delete(p); else { ex.add(p); load(fold, p, { again: true }); }
      paint();
      return;
    }
    const f = t.closest("[data-mp-file]");
    if (f && fold) {
      M.quietUntil = Date.now() + QUIET_MS;
      const rel = f.dataset.mpFile;
      viewer.open({ name: base(rel), path: rel, project: fold.project, rel: apiRel(fold, rel) }, f);
    }
  });
  // the Live · File switch, drawn on the Map and on the viewer alike
  document.addEventListener("click", (e) => {
    const s = e.target.closest?.("[data-stage]");
    if (!s) return;
    const what = s.dataset.stage;
    if (what === "live") { viewer.park(); M.html = ""; paint(); el.focus({ preventScroll: true }); }
    else if (what === "file") viewer.unpark();
    else if (what === "close-file") { viewer.close({ restore: false }); M.html = ""; paint(); el.focus({ preventScroll: true }); }
  });
  el.addEventListener("wheel", () => { M.quietUntil = Date.now() + QUIET_MS; }, { passive: true });
  el.addEventListener("touchmove", () => { M.quietUntil = Date.now() + QUIET_MS; }, { passive: true });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !viewer.isOpen) { e.preventDefault(); e.stopPropagation(); close(); }
  });

  function close() { if (!M.open) return; const back = document.querySelector("[data-map-toggle]"); setOpen(false); back?.focus({ preventScroll: true }); }

  if (M.open) { document.body.classList.add("map-open"); el.hidden = false; }

  return {
    get isOpen() { return M.open; },
    /** The header's Map button: shows Live (parking a file in front of it), or closes the panel. */
    toggle: () => (M.open && viewer.isOpen ? (viewer.park(), (M.html = ""), paint(), el.focus({ preventScroll: true })) : M.open ? close() : setOpen(true)),
    tabs,
    open: () => setOpen(true),
    close,
    /** The view changed or the world moved: follow it. */
    render(v) {
      if (v !== M.view) { M.view = v; M.html = ""; M.quietUntil = 0; }
      paint();
    },
    /** The header's toggle, for any conversation view. */
    button(v) {
      const live = liveIn(v);
      return `<button type="button" class="map-btn${M.open ? " is-on" : ""}" data-map-toggle aria-pressed="${M.open}" aria-controls="map" title="Map: where your agents are working">${MAP_ICON}${live ? `<i class="map-dot" aria-hidden="true"></i>` : ""}<span>Map</span></button>`;
    },
  };
}
