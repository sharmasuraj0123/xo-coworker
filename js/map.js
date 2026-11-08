// The Map: where your agents are working, drawn. One button (top right of every conversation, ⌘\)
// opens it beside the conversation; it follows the view you're on:
//   · a thread: its folder (its own worktree) drawn as a diagram, boxes and connectors, and its agent as
//     a cursor that glides from file to file as it reads and edits. What it made or changed is marked.
//   · a project: the project's folder, with every agent working in it as its own coloured cursor.
//   · Home, the Workspace, Chats: your projects, with the agents at work in them.
// Drag (or scroll) to pan, ⌘/Ctrl-scroll or pinch to zoom; Fit, Follow, and a full-size mode. A box
// opens what it is: a folder unfolds, a file opens in the viewer, a project or an agent's name goes there.
// The Map and the file viewer are one right-hand panel with two modes, Live and File: a file opened shows
// as File, with a Live · File switch on top; Live parks the file and File brings it back as it was. The
// Needs you panel takes the right side while it is open and gives it back after. On a phone it is a full
// sheet.
//
// What it reads: the turns the stream already brings (storm's activity rows: kind, target, status),
// and GET /api/xo-projects/<project>/tree (one level per call; it serves a thread's worktree under
// `.xo/worktrees/<name>` too). Nothing here writes.

import { esc } from "./world.js";
import { ICON, $, elapsed } from "./ui.js";
import { api } from "./api.js";
import { renderInline } from "./markdown.js";
import { isImagePath } from "./util.js";
import { commsLine } from "./comms.js";
import { fileIcon, folderIcon, fileColor } from "./fileicons.js";

const KEY = "cv-map";
const FILE_KINDS = new Set(["create_file", "edit_file", "delete_file", "read"]);
const VERB_NOW = { create_file: "Writing", edit_file: "Editing", delete_file: "Deleting", read: "Reading" };

// the drawing
const NW = 148, NH = 32, COL = 184, ROW = 42, PAD = 28; // compact: two columns read at 360px

const FILE_CAP = 8, DIR_CAP = 14; // boxes a folder shows before "N more"
const PALETTE = ["#4C8DFF", "#A472FF", "#FF6FAE", "#FF9F43", "#2EC4B6", "#E5C23A"];
const COORD_COLOR = "#7ED957";

export const MAP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="5" rx="1.5"/><rect x="14" y="4" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/><path d="M10 6.5h4M6.5 9v8.5H14"/></svg>';
const DIR_OPEN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 18V7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h7A1.5 1.5 0 0 1 19.5 9v1.5"/><path d="M3.5 18l2.3-6.4a1.5 1.5 0 0 1 1.4-1h13.3l-2.4 7.4H3.5z"/></svg>';
// the pointer: a crisp arrow, its tip at (1, 1), white-edged so it reads on any box
const ARROW = '<svg class="dg-arrow" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M1.6 1.4 15.6 7.1c.5.2.5.9 0 1.1l-5.9 2.2a1 1 0 0 0-.6.6l-2.2 5.9c-.2.5-.9.5-1.1 0L.2 2.9C0 2 .8 1.1 1.6 1.4z"/></svg>';
const MODE_KEY = "cv-map-mode";
const I = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TOOL = {
  out: I('<path d="M6 12h12"/>'), in: I('<path d="M6 12h12M12 6v12"/>'),
  fit: I('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
  follow: I('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  full: I('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  tree: I('<rect x="3" y="4" width="7" height="5" rx="1"/><rect x="14" y="4" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/><path d="M10 6.5h4M6.5 9v8.5H14"/>'),
  graph: I('<circle cx="6" cy="6" r="2.3"/><circle cx="18" cy="8" r="2.3"/><circle cx="9" cy="18" r="2.3"/><circle cx="18" cy="18" r="1.6"/><path d="M8.2 6.4l7.6 1.2M7 8.2l1.5 7.6M11.2 17.6l5.3.3M17.9 10.3v6.1"/>'), unfull: I('<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>'),
};

const base = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();
const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** An agent's colour: the same agent keeps it, wherever it shows. */
export function colorOf(id) { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }


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

/** A path with "." and ".." resolved; null if it climbs above its start. */
function norm(p) {
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (!out.length) return null; out.pop(); } else out.push(seg);
  }
  return (p.startsWith("/") ? "/" : "") + out.join("/");
}

/**
 * The files and folders a shell command names, inside `root`, in order: so a cursor can follow an agent
 * through `cd js && sed -i … app.js` as well as through its edits. A `cd` moves where later relative
 * paths start; a glob counts as its folder; flags, URLs and sed-like expressions don't count. Pure.
 */
export function pathsInCommand(cmd, root) {
  const out = [];
  let cwd = root || "";
  for (const part of String(cmd || "").split(/&&|\|\||;|\||\n/)) {
    const words = (part.trim().match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ""));
    if (!words.length) continue;
    if (words[0] === "cd") {
      const d = words[1];
      if (d && !d.startsWith("-")) { const n = norm(d.startsWith("/") ? d : `${cwd}/${d}`); if (n) cwd = n; }
      continue;
    }
    for (const w of words.slice(1)) {
      if (!w || w.length > 240 || w.startsWith("-") || w.includes("://") || /[\\^$#|<>(){}=;'"`\s]/.test(w)) continue;
      if (!(w.includes("/") || /\.[A-Za-z0-9]{1,8}$/.test(w))) continue;
      if (/^s([\/#|]).*\1.*\1[gimp]*$/.test(w)) continue; // a sed expression, not a path
      let p = w.replace(/[,:]+$/, "");
      const g = p.search(/[*?[]/);
      if (g >= 0) p = p.slice(0, g).replace(/\/[^/]*$/, "");
      if (!p) continue;
      const abs = norm(p.startsWith("/") ? p : cwd ? `${cwd}/${p}` : p);
      if (!abs) continue;
      const pl = placeOf(root, abs);
      if (pl && pl.rel != null) out.push(pl.rel);
    }
  }
  return out;
}

/**
 * What a session's loaded turns did, from storm's activity rows. Pure: `turns` is the turn store.
 * → {files: Map rel → F, outside: Map abs → F, now: {row, turn} | null, last, running,
 *    nowSpots: the paths the running step names (a command's files), lastFile: the last file it was on}
 * F = {path, mark: "new" | "edited" | "deleted" | "read", live, waiting, verb}
 */
export function activityOf(turns, session, root) {
  const out = { files: new Map(), outside: new Map(), now: null, last: null, running: null, nowSpots: [], lastFile: null };
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
        if (on && (r.kind === "command" || r.kind === "search" || r.kind === "list") && r.target) out.nowSpots = pathsInCommand(r.target, root);
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
        if (pl.rel != null) out.lastFile = pl.rel;
      }
    }
  }
  for (const m of [out.files, out.outside]) for (const f of m.values()) {
    f.mark = f.lastKind === "delete_file" ? "deleted" : f.kinds.has("create_file") ? "new" : f.kinds.has("edit_file") ? "edited" : "read";
  }
  return out;
}


/**
 * A tree laid out left to right, like a hand-drawn diagram: each level a column, each leaf a row, a
 * parent centred on its children. Pure. node: {id, children?} → {nodes (with x, y), edges, w, h}.
 */
export function layoutOf(root, { col = COL, row = ROW, nw = NW, nh = NH } = {}) {
  const nodes = [], edges = [];
  let y = 0;
  const place = (n, depth, parent) => {
    n.x = depth * col;
    const kids = n.children || [];
    if (!kids.length) { n.y = y; y += row; }
    else { for (const c of kids) place(c, depth + 1, n); n.y = (kids[0].y + kids[kids.length - 1].y) / 2; }
    nodes.push(n);
    if (parent) edges.push({ from: parent, to: n });
  };
  place(root, 0, null);
  const w = Math.max(...nodes.map((n) => n.x)) + nw;
  return { nodes, edges, w, h: Math.max(row, y) - row + nh };
}

/** A connector: out of the parent's right side, along a shared trunk, into the child, corners rounded. */
export function edgePath(p, c, { nw = NW, nh = NH, r = 8 } = {}) {
  const x1 = p.x + nw, y1 = p.y + nh / 2, x2 = c.x, y2 = c.y + nh / 2;
  const xm = x1 + Math.min(28, (x2 - x1) / 2);
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
  const d = y2 > y1 ? 1 : -1, rr = Math.min(r, Math.abs(y2 - y1) / 2);
  return `M${x1} ${y1}H${xm - rr}Q${xm} ${y1} ${xm} ${y1 + d * rr}V${y2 - d * rr}Q${xm} ${y2} ${xm + rr} ${y2}H${x2}`;
}

/**
 * The Map. Two ways to host it:
 *  · in the right panel (js/stage.js): mount(host) once, then show(view) / hide() as its tab shows and
 *    hides, render(view) on every app render, live(view) for the tab's and the header's dot. Files open
 *    through `openFile`. The panel owns the card, tabs, close, full size, Esc and persistence.
 *  · standalone (#map, until the panel lands): open/close/toggle/button/tabs, files through `viewer`.
 *    None of that runs once the Map is mounted.
 */
export function createMap({ world, viewer = null, go, announce, isBusy, onChange, openFile = null }) {
  let el = $("#map"); // the panel it draws in: its own #map, or a host's tab (mount)
  let saved = false; // standalone only: was #map open last time (read on the first render, if nothing mounted it)
  try { saved = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }
  const M = {
    open: false, view: "home", full: false, hosted: false, restored: false,
    dirs: new Map(),     // "<project>|<api rel>" → {state: "loading"|"ok"|"error", dirs, files, error}
    opened: new Map(),   // scope key → folders you unfolded
    closed: new Map(),   // scope key → folders you folded (even with an agent inside)
    more: new Map(),     // scope key → folders showing every box
    shown: new Map(),    // scope key → boxes that have been on screen (they stay, so nothing reshuffles)
    autoOpen: new Map(), // scope key → folders that unfolded by themselves (kept, unless the panel is too narrow)
    cams: new Map(),     // scope key → {x, y, s, user, follow, target}
    refs: new Map(),     // box id → what a click on it does
    curs: new Map(),     // agent id → its cursor element and where it was
    head: "", layoutKey: "", scope: null, layout: null, dragged: false,
    mode: "tree",        // "tree": the diagram; "graph": a living node graph
    bounds: null,        // the drawing's extent, for Fit
    gpos: new Map(),     // scope key → Map box id → {x, y, vx, vy}: the graph keeps its shape across redraws
    gkey: "", gnodes: [], gedges: [], alpha: 0, raf: 0, gags: [], glit: new Map(),
  };
  try { if (localStorage.getItem(MODE_KEY) === "graph") M.mode = "graph"; } catch { /* private mode */ }
  // a cursor is its arrow: what the agent is doing is said once, in the line above the drawing (a
  // thread) or its chip (a project); the arrow's tag shows on hover. So it needs only the arrow's room.
  const tagW = () => 22;
  const setOf = (m, key) => { if (!m.has(key)) m.set(key, new Set()); return m.get(key); };

  // ── what's in scope ─────────────────────────────────────────────────────────
  function scopeOf(v) {
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) return { kind: "thread", t, key: v, fold: folderOf(t) }; }
    if (v.startsWith("p:")) return { kind: "project", pid: v.slice(2), key: v, fold: { project: v.slice(2), base: "" } };
    return { kind: "all", key: "all" };
  }
  const turns = () => world.state.turns || null;

  /** One agent: a thread, or a project's coordinator. → {id, title, go, project, fold, act, now, path, live, waiting, since, color} */
  function agentOf(t) {
    const fold = folderOf(t);
    const a = activityOf(turns(), t.sessionId, fold && fold.root);
    const now = a.now && a.now.row;
    const liveFile = [...a.files.values()].filter((f) => f.live).sort((x, y) => y.seq - x.seq)[0] || null;
    const lastFile = [...a.files.values()].sort((x, y) => y.seq - x.seq)[0] || null;
    const busy = isBusy(t);
    return { id: t.id, title: t.title, go: "t:" + t.id, project: t.project, fold, act: a, now, liveFile, path: (liveFile || (!busy && lastFile) || null)?.path || null, spots: a.nowSpots, prev: a.lastFile, busy, waiting: !!(now && now.waiting), since: a.running ? Date.parse(a.running.at) : null, color: colorOf(t.id) };
  }
  function coordinatorOf(pid) {
    const sid = world.act.coordinatorBusy && world.act.coordinatorBusy(pid);
    if (!sid) return null;
    const anyT = world.state.threads.find((x) => x.project === pid && folderOf(x));
    const root = anyT ? folderOf(anyT).projectRoot : null;
    const a = activityOf(turns(), sid, root);
    const now = a.now && a.now.row;
    const liveFile = [...a.files.values()].filter((f) => f.live).sort((x, y) => y.seq - x.seq)[0] || null;
    return { id: "coord:" + pid, title: "Coordinator", go: pid === "workspace" ? "ws" : "p:" + pid, project: pid, fold: root ? { root, base: "", project: pid } : null, act: a, now, liveFile, path: liveFile ? liveFile.path : null, spots: a.nowSpots, prev: a.lastFile, busy: true, waiting: !!(now && now.waiting), since: a.running ? Date.parse(a.running.at) : null, coord: true, color: COORD_COLOR };
  }
  function agentsIn(pid) {
    const out = world.state.threads.filter((t) => (!pid || t.project === pid) && isBusy(t)).map(agentOf);
    const pids = pid ? [pid] : [...new Set(world.state.projects.map((p) => p.id))];
    for (const p of pids) { const c = coordinatorOf(p); if (c) out.unshift(c); }
    return out;
  }

  // ── words ──────────────────────────────────────────────────────────────────
  /** What an agent is doing, in one line: its running step, else what its turn is on. */
  function doingLine(ag) {
    if (ag.now) { const said = commsLine(ag.now, { project: ag.project }); return said ? esc(said) : renderInline(ag.now.line || ag.now.tool || "Working", true); }
    if (ag.act.running) {
      const bl = turns().blocksOf(ag.act.running);
      const last = bl[bl.length - 1];
      return esc(last ? (last.type === "thinking" ? "Thinking" : last.type === "text" || last.type === "answer" ? "Writing its reply" : String(last.header || "Working").replace(/`/g, "")) : "Starting");
    }
    return ag.busy ? "Working" : "Not working right now";
  }
  /** The cursor's short word: "editing", "reading", "running a command"… */
  function verbOf(ag) {
    if (ag.waiting) return "waiting for you";
    if (!ag.busy) return "idle";
    if (ag.liveFile) return (ag.liveFile.verb || "working").toLowerCase();
    const k = ag.now && ag.now.kind;
    const said = ag.now && commsLine(ag.now, { project: ag.project });
    if (said) return said.replace(/…$/, "").replace(/^\w/, (c) => c.toLowerCase());
    return k === "command" ? "running a command" : k === "search" || k === "list" ? "looking around" : k === "web_search" || k === "web_fetch" ? "on the web" : k === "subagent" ? "with a sub-agent" : ingOf(ag.now) || (ag.act.running ? "thinking" : "working");
  }
  /** A running step's own verb ("Writing… · 12 KB" → "writing"), when its line starts with one. */
  const ingOf = (row) => { const w = String((row && row.line) || "").replace(/[`*_]/g, "").trim().split(/[\s…·.]+/)[0] || ""; return /^[A-Za-z]{3,}ing$/.test(w) ? w.toLowerCase() : ""; };
  const since = (ms) => (Number.isFinite(ms) ? `<span class="elapsed" data-since="${ms}"></span>` : "");

  // ── folders, read a level at a time ──────────────────────────────────────────
  const apiRel = (fold, local) => (fold.base ? (local ? `${fold.base}/${local}` : fold.base) : local);
  const dirKey = (fold, local) => `${fold.project}|${apiRel(fold, local)}`;
  async function load(fold, local, { again = false } = {}) {
    const k = dirKey(fold, local);
    const had = M.dirs.get(k);
    if (had && (had.state === "loading" || ((had.state === "ok" || had.state === "error") && !again))) return;
    M.dirs.set(k, { ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading" });
    try {
      const d = await api.projectTree(fold.project, apiRel(fold, local));
      const strip = (e) => { let p = String(e.relative_path || e.name); if (fold.base && p.startsWith(fold.base + "/")) p = p.slice(fold.base.length + 1); return { name: e.name, path: p }; };
      M.dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip) });
    } catch (err) {
      M.dirs.set(k, { state: "error", error: err.status === 404 ? "Not there any more" : "Couldn't read it" });
    }
    paint();
  }

  // ── the diagram's boxes ─────────────────────────────────────────────────────
  /** A folder as boxes: the folders and files it holds, those with agents (or changes) first. */
  function folderTree(scope, fold, marks, hot, auto = true) {
    const opened = setOf(M.opened, scope.key), closed = setOf(M.closed, scope.key), more = setOf(M.more, scope.key);
    const inside = (set, p) => { for (const h of set) if (h === p || h.startsWith(p + "/")) return true; return false; };
    const marked = new Set(marks.keys());
    // a thread's changes unfold their folders while there are few of them
    // folders an agent is in (or a thread changed) unfold by themselves only when `auto`: paint() turns it
    // off when the drawing would then be too wide to read whole in the panel
    const roomy = auto;
    const unfoldMarks = roomy && scope.kind === "thread" && marked.size <= 16;
    const autoSet = setOf(M.autoOpen, scope.key);
    // a folder an agent went into stays open after it leaves, so the drawing never folds up under you
    const isOpen = (p) => { if (opened.has(p)) return true; if (closed.has(p)) return false; if (roomy && (autoSet.has(p) || inside(hot, p) || (unfoldMarks && inside(marked, p)))) { autoSet.add(p); return true; } return false; };
    const kids = (local) => {
      load(fold, local);
      const d = M.dirs.get(dirKey(fold, local));
      if (!d || (d.state === "loading" && !d.dirs)) return [{ id: local + "/…", kind: "note", name: "Reading…" }];
      if (d.state === "error") { M.refs.set(local + "/!", { retry: local, fold }); return [{ id: local + "/!", kind: "note", name: `${d.error} · Try again`, btn: true }]; }
      const all = more.has(local);
      // which boxes show: the ones an agent is on or changed always, then the first on disk up to the cap.
      // They're drawn in their order on disk, and one that has shown keeps showing, so nothing reshuffles.
      const seen = setOf(M.shown, scope.key);
      const pick = (list, cap) => {
        if (all || list.length <= cap) return list;
        const must = new Set(list.filter((x) => inside(hot, x.path) || inside(marked, x.path) || seen.has(x.path)).map((x) => x.path));
        let room = cap - must.size;
        return list.filter((x) => must.has(x.path) || (room-- > 0));
      };
      const dirs = d.dirs, files = d.files;
      const sd = pick(dirs, DIR_CAP), sf = pick(files, FILE_CAP);
      for (const x of sd) seen.add(x.path);
      for (const x of sf) seen.add(x.path);
      const out = [];
      for (const c of sd) {
        const open = isOpen(c.path);
        M.refs.set(c.path, { toggle: c.path, open });
        out.push({ id: c.path, kind: "dir", name: c.name, open, dot: !open && (inside(hot, c.path) ? "hot" : inside(marked, c.path) ? "mark" : ""), children: open ? kids(c.path) : [] });
      }
      for (const f of sf) {
        const m = marks.get(f.path);
        if (!m || m.mark !== "deleted") M.refs.set(f.path, { open: { name: f.name, path: f.path, project: fold.project, rel: apiRel(fold, f.path) } });
        out.push({ id: f.path, kind: "file", name: f.name, mark: m ? m.mark : "" });
      }
      // a deleted file isn't on disk any more, but the diagram still says it went
      for (const [p, m] of marks) if (m.mark === "deleted" && parentOf(p) === local && !d.files.some((f) => f.path === p)) out.push({ id: p, kind: "file", name: base(p), mark: "deleted" });
      const hidden = dirs.length - sd.length + files.length - sf.length;
      if (hidden > 0) { M.refs.set(local + "/+", { more: local }); out.push({ id: local + "/+", kind: "more", name: `${hidden} more` }); }
      if (!out.length) out.push({ id: local + "/∅", kind: "note", name: "Empty" });
      return out;
    };
    const name = (world.project(fold.project) || {}).name || fold.project;
    return { id: "", kind: "root", name, title: scope.kind === "thread" && fold.base ? `${name}, its own worktree` : name, children: kids("") };
  }

  /** Home and the Workspace: your projects, and the files their agents are on. */
  function projectsTree(ags) {
    const by = new Map();
    for (const a of ags) { const k = a.project || "workspace"; if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
    const ps = world.state.projects.filter((p) => p.kind === "project" || by.has(p.id));
    ps.sort((a, b) => (by.has(b.id) ? 1 : 0) - (by.has(a.id) ? 1 : 0));
    const children = ps.map((p) => {
      const id = "p:" + p.id;
      M.refs.set(id, { go: p.id === "workspace" ? "ws" : id });
      const files = new Map();
      for (const a of by.get(p.id) || []) if (a.path && a.fold) {
        const fid = `${id}|${a.fold.base}|${a.path}`;
        if (!files.has(fid)) { files.set(fid, { id: fid, kind: "file", name: a.path.split("/").slice(-2).join("/"), title: a.path }); M.refs.set(fid, { open: { name: base(a.path), path: a.path, project: a.fold.project, rel: apiRel(a.fold, a.path) } }); }
        a.node = fid;
      }
      for (const a of by.get(p.id) || []) if (!a.node) a.node = id;
      return { id, kind: "project", name: p.id === "workspace" ? "Workspace" : p.name || p.id, children: [...files.values()] };
    });
    return { id: "@", kind: "root", name: "Your projects", children };
  }

  function boxHtml(n, at) {
    const here = at.get(n.id);
    const cls = `dg-n k-${n.kind}${n.mark ? ` m-${n.mark}` : ""}${n.open ? " is-open" : ""}${here ? " is-here" : ""}`;
    const ic = n.kind === "root" ? (M.scope.kind === "all" ? MAP_ICON : M.scope.kind === "thread" ? ICON.branch : ICON.project)
      : n.kind === "project" ? ICON.project : n.kind === "dir" ? folderIcon(n.open)
      : n.kind === "file" ? fileIcon(n.name) : n.kind === "more" ? ICON.plus : n.btn ? ICON.retry : `<i class="spin" aria-hidden="true"></i>`;
    const tail = n.kind === "dir" ? (n.dot ? `<i class="dg-dot d-${n.dot}" aria-hidden="true"></i>` : "") + `<span class="dg-ch" aria-hidden="true">${ICON.chevron}</span>`
      : n.mark && n.mark !== "read" ? `<span class="dg-mk">${n.mark}</span>` : "";
    const style = `left:${n.x + PAD}px;top:${n.y + PAD}px${here ? `;--c:${here}` : ""}`;
    const inner = `<span class="dg-ic">${ic}</span><span class="dg-t">${esc(n.name)}${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</span>${tail}`;
    const clickable = M.refs.has(n.id) || n.kind === "more";
    const label = n.kind === "dir" ? `${n.name}, folder, ${n.open ? "open" : "folded"}` : n.kind === "file" ? `${n.title || n.name}${n.mark && n.mark !== "read" ? `, ${n.mark}` : ""}, open it` : n.name;
    return clickable
      ? `<button type="button" class="${cls}" style="${style}" data-node="${esc(n.id)}" aria-label="${esc(label)}" title="${esc(n.title || n.id || n.name)}"${n.kind === "dir" ? ` aria-expanded="${!!n.open}"` : ""}>${inner}</button>`
      : `<div class="${cls}" style="${style}">${inner}</div>`;
  }

  // ── the canvas ─────────────────────────────────────────────────────────────
  function skeleton(scope) {
    el.innerHTML = `<div class="mp-head" data-mp-head></div>` +
      `<div class="dg" data-dg tabindex="0" role="group" aria-label="The diagram: drag to move around, ⌘ or Ctrl and scroll to zoom">` +
      `<div class="dg-world k-${M.mode}"><svg class="dg-edges" aria-hidden="true"></svg><div class="dg-nodes"></div><div class="dg-curs"></div></div>` +
      `<div class="dg-tools" role="toolbar" aria-label="View">` +
      `<span class="dg-mode" role="group" aria-label="Draw it as"><button type="button" data-dg="tree" aria-pressed="${M.mode === "tree"}" title="Diagram (G)" aria-label="Diagram">${TOOL.tree}</button><button type="button" data-dg="graph" aria-pressed="${M.mode === "graph"}" title="Graph (G)" aria-label="Graph">${TOOL.graph}</button></span><i class="dg-sep" aria-hidden="true"></i>` +
      `<button type="button" data-dg="out" title="Zoom out (−)" aria-label="Zoom out">${TOOL.out}</button><button type="button" data-dg="in" title="Zoom in (+)" aria-label="Zoom in">${TOOL.in}</button>` +
      `<button type="button" data-dg="fit" title="Fit it all (0)" aria-label="Fit it all">${TOOL.fit}</button>` +
      (scope.kind !== "all" ? `<button type="button" data-dg="follow" title="Follow the agent (F)" aria-label="Follow the agent" aria-pressed="false">${TOOL.follow}</button>` : "") + `</div>` +
      `<div class="dg-key" data-dg-key></div></div>`;
    M.head = ""; M.layoutKey = ""; M.curs = new Map(); M.gkey = ""; M.gnodes = []; M.gedges = [];
    el.dataset.scope = scope.key + "|" + M.mode;
    wire(el.querySelector("[data-dg]"));
  }
  const view = () => el.querySelector("[data-dg]");
  /** After a redraw, the node that had focus, by its id; if it's gone (a folder's Try again becomes the folder
   *  once it reads), the nearest node above it; else the drawing. Both drawings (Diagram, Graph). (S082) */
  function focusNode(nodes, fid) {
    let id = fid, to = null;
    while (!to && id) { to = nodes.querySelector(`[data-node="${CSS.escape(id)}"]`); id = id.includes("/") ? id.replace(/\/[^/]*$/, "") : ""; }
    (to || view())?.focus({ preventScroll: true });
  }
  const world$ = () => el.querySelector(".dg-world");

  function camOf(scope) {
    const k = scope.key + "|" + M.mode;
    if (!M.cams.has(k)) M.cams.set(k, { x: 24, y: 24, s: 1, user: false, follow: scope.kind === "thread" && M.mode === "tree", target: null });
    return M.cams.get(k);
  }
  function applyCam(c, glide) {
    const w = world$();
    if (!w) return;
    w.classList.toggle("is-glide", !!glide);
    w.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.s})`;
    w.style.setProperty("--dg-s", String(c.s));
    w.classList.toggle("is-near", c.s >= 1.15); // close enough to read every name
    const f = el.querySelector('[data-dg="follow"]');
    if (f) f.setAttribute("aria-pressed", String(!!c.follow));
  }
  const READABLE = 0.8; // the smallest scale for a partial view (all = false): labels stay readable (≈10px)
  // the smallest scale a box can be pressed surely at: boxes are 32 tall, 42 apart, so a box's target may grow 5
  // into the 10 between (css: .dg-n::before), 42 in all; 42 × this = 24 px. Further out, a pointer press brings the
  // map in to the box instead of acting on it (the keyboard acts at any size) (Files/Map grader on b153247)
  const PRESS_MIN = 24 / 42;
  /** Frame the drawing. The Map shows it all, fitted to whatever size its frame is (the owner, 4 Nov:
   *  "I asked for the map to fit it all"), by itself and with Fit; all = false is the old readable
   *  partial view, kept for callers that want it. */
  function fit(c, glide, all = false) {
    const v = view(), B = M.bounds;
    if (!v || !B || !v.clientWidth) return;
    const W = B.x1 - B.x0, H = B.y1 - B.y0, vh = v.clientHeight - 44, cw = v.clientWidth - 24, ch = vh - 24;
    const s = Math.min(cw / W, ch / H);
    // Fit shows it all, whatever it takes (S207: a 0.3 floor left 16 of 32 folders outside); a small scale keeps
    // the controls' hit areas (css: .dg-n::before, from --dg-s)
    c.s = clamp(s, all ? 0.05 : READABLE, 1.1);
    if (!all && s < READABLE) {
      // too tall to read whole: as wide as reads (all of it across), starting at the top box
      c.s = clamp(cw / W, READABLE, 1.1);
      const r = M.rootPt || { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2 };
      c.x = W * c.s <= cw ? 12 + (cw - W * c.s) / 2 - B.x0 * c.s : 12 - B.x0 * c.s;
      c.y = vh / 2 - r.y * c.s;
    } else {
      c.x = (v.clientWidth - W * c.s) / 2 - B.x0 * c.s;
      c.y = Math.max(0, (vh - H * c.s) / 2) - B.y0 * c.s;
    }
    c.fitB = { x0: B.x0, y0: B.y0, x1: B.x1, y1: B.y1 };
    applyCam(c, glide);
  }
  function centerOn(c, pt, glide, s) {
    const v = view();
    if (!v || !v.clientWidth) return;
    if (s) c.s = s;
    c.x = v.clientWidth / 2 - (pt.x + tagW() / 2) * c.s; // the cursor and its name, not just the box
    c.y = (v.clientHeight - 44) / 2 - pt.y * c.s;
    applyCam(c, glide);
  }
  function zoomAt(c, f, px, py) {
    const s = clamp(c.s * f, 0.25, 2.4);
    c.x = px - (px - c.x) * (s / c.s); c.y = py - (py - c.y) * (s / c.s); c.s = s;
    c.user = true; c.fitAll = false;
    applyCam(c, false);
  }

  /** Pan with a drag (a pinch zooms), scroll pans, ⌘/Ctrl-scroll zooms; a drag never counts as a click. */
  function wire(v) {
    const pts = new Map();
    let start = null;
    v.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.target.closest(".dg-tools, .dg-key, .dg-tag")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = camOf(M.scope);
      start = { pts: new Map(pts), x: c.x, y: c.y, s: c.s, moved: false };
    });
    v.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = camOf(M.scope);
      const [a, b] = [...pts.values()];
      const [a0, b0] = [...start.pts.values()];
      if (pts.size === 1 && a0) {
        const dx = a.x - a0.x, dy = a.y - a0.y;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        if (!start.moved) { start.moved = true; v.setPointerCapture(e.pointerId); v.classList.add("is-drag"); }
        c.x = start.x + dx; c.y = start.y + dy;
      } else if (b && b0) {
        const r = v.getBoundingClientRect();
        const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const s = clamp(start.s * (d1 / d0), 0.25, 2.4);
        c.x = mx - (mx - start.x) * (s / start.s); c.y = my - (my - start.y) * (s / start.s); c.s = s;
        start.moved = true;
      } else return;
      c.user = true; c.follow = false; c.fitAll = false;
      applyCam(c, false);
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (start && start.moved) { M.dragged = true; setTimeout(() => { M.dragged = false; }, 0); }
      v.classList.remove("is-drag");
      if (!pts.size) start = null; else { const c = camOf(M.scope); start = { pts: new Map(pts), x: c.x, y: c.y, s: c.s, moved: true }; }
    };
    v.addEventListener("pointerup", up);
    v.addEventListener("pointercancel", up);
    v.addEventListener("wheel", (e) => {
      e.preventDefault();
      const c = camOf(M.scope);
      if (e.ctrlKey || e.metaKey) { const r = v.getBoundingClientRect(); zoomAt(c, Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); }
      else { c.x -= e.deltaX; c.y -= e.deltaY; c.user = true; c.follow = false; c.fitAll = false; applyCam(c, false); }
    }, { passive: false });
    v.addEventListener("keydown", (e) => {
      if (e.target !== v || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = camOf(M.scope), mid = () => [v.clientWidth / 2, v.clientHeight / 2];
      const k = e.key;
      if (k === "+" || k === "=") zoomAt(c, 1.2, ...mid());
      else if (k === "-" || k === "_") zoomAt(c, 1 / 1.2, ...mid());
      else if (k === "0") { c.user = true; c.follow = false; c.fitAll = true; fit(c, true, true); }
      else if (k === "f" || k === "F") tool("follow");
      else if (k === "g" || k === "G") tool(M.mode === "graph" ? "tree" : "graph");
      else if (k.startsWith("Arrow")) { const d = 60; c.x += k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0; c.y += k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0; c.user = true; c.follow = false; c.fitAll = false; applyCam(c, true); }
      else return;
      e.preventDefault();
    });
  }

  function tool(what, { focus = true } = {}) {
    const c = camOf(M.scope), v = view();
    if (!v) return;
    if (what === "in" || what === "out") zoomAt(c, what === "in" ? 1.25 : 0.8, v.clientWidth / 2, v.clientHeight / 2);
    else if (what === "fit") { c.user = true; c.follow = false; c.fitAll = true; fit(c, true, true); }
    else if (what === "tree" || what === "graph") {
      if (M.mode === what) return;
      M.mode = what;
      // the other drawing has its own size: give it its own fitted first look (unless you've moved the view)
      { const c0 = camOf(M.scope); if (!c0.user || c0.fitAll) { c0.done = false; c0.settleUntil = 0; c0.target = null; c0.fitB = null; } }
      try { localStorage.setItem(MODE_KEY, what); } catch { /* private mode */ }
      el.dataset.scope = "";
      paint();
      // from the map's own buttons, the keys go to the drawing; from the panel's tabs they stay on the tabs, so
      // the next arrow moves between tabs instead of panning (Astra C080/C081)
      if (focus) view()?.focus({ preventScroll: true });
      announce(what === "graph" ? "Graph view." : "Diagram view.");
    }
    else if (what === "follow") {
      c.follow = !c.follow; c.user = false;
      if (c.follow && M.lead) { c.target = M.lead.key; centerOn(c, M.lead.pt, true); }
      // the button says it at once, not on the next camera move (Astra S208: it stayed pressed after turning off)
      el.querySelector('[data-dg="follow"]')?.setAttribute("aria-pressed", String(!!c.follow));
      announce(c.follow ? "Following the agent." : "Not following.");
    }
  }

  /**
   * Where the camera goes by itself. For its first moment on screen it frames the drawing (or the
   * followed agent) as it loads; after that it holds still: the cursor moves, the drawing doesn't.
   * Follow only nudges the view, gently, when the cursor would leave it.
   */
  const SETTLE_MS = 1600;
  function frame(c) {
    if (!M.bounds) return;
    // hidden (a closed panel, a background tab) or not laid out yet: framing now would frame nothing
    const v = view();
    if (!v || !v.clientWidth || !v.clientHeight) return;
    const now = Date.now(), lead = M.lead;
    if (!c.user && !c.done) {
      // the first look lasts until the folder has loaded (and the graph has calmed), then a moment more
      if (!c.settleUntil) c.settleUntil = now + (M.mode === "graph" ? SETTLE_MS + 1200 : SETTLE_MS);
      if (M.loading || (M.mode === "graph" && M.alpha > 0.06)) c.settleUntil = Math.max(c.settleUntil, now + 500);
      if (now < c.settleUntil) {
        fit(c, false, true); // the first look shows the whole drawing, fitted; Follow takes over after it
        c.target = lead ? lead.key : null;
        return;
      }
      c.done = true;
    }
    // the drawing grew or shrank (a folder loaded, a box unfolded, the graph moved): still all of it,
    // unless you've moved the view yourself since your last Fit
    // (a change of 8 px or less is the graph breathing: the view holds still for it, unless the drawing
    // would cross the frame's edge, which it never may)
    const B = M.bounds, F = c.fitB;
    const moved = !F || Math.max(Math.abs(B.x0 - F.x0), Math.abs(B.y0 - F.y0), Math.abs(B.x1 - F.x1), Math.abs(B.y1 - F.y1)) > 8;
    const over = B.x0 * c.s + c.x < 0 || B.x1 * c.s + c.x > v.clientWidth || B.y0 * c.s + c.y < 0 || B.y1 * c.s + c.y > v.clientHeight - 44;
    if ((!c.user || c.fitAll) && (moved || over)) { fit(c, true, true); return; }
    if (c.follow && lead && c.target !== lead.key) { c.target = lead.key; keepInView(c, lead.pt); }
  }
  /** A fresh first look for this view's camera, unless you've moved it yourself. */
  function reframe(scope) {
    const c = camOf(scope);
    if (!c.user) { c.done = false; c.settleUntil = 0; c.target = null; }
  }
  /** Pan just enough that `pt` (and its name) is comfortably inside the view; never zoom. */
  function keepInView(c, pt) {
    const v = view();
    if (!v || !v.clientWidth) return;
    const W = v.clientWidth, H = v.clientHeight - 44, m = 48;
    const sx = c.x + pt.x * c.s, sy = c.y + pt.y * c.s;
    const right = W - m - Math.min(tagW() * c.s, W / 3);
    let dx = 0, dy = 0;
    if (sx < m) dx = m + W * 0.12 - sx; else if (sx > right) dx = right - W * 0.12 - sx;
    if (sy < m) dy = m + H * 0.12 - sy; else if (sy > H - m) dy = H - m - H * 0.12 - sy;
    if (dx || dy) { c.x += dx; c.y += dy; applyCam(c, true); }
  }

  /** The drawing changed shape: shift the camera so the box you were looking at doesn't move on screen. */
  function holdStill(scope, old, L) {
    const c = camOf(scope), v = view();
    if (!v || !v.clientWidth || (!c.user && !c.done)) { M.anchorId = null; return; }
    const was = new Map(old.nodes.map((n) => [n.id, n]));
    let pair = null;
    for (const id of [M.anchorId, M.leadNode]) {
      if (pair || id == null) continue;
      const o = was.get(id), n = L.nodes.find((x) => x.id === id);
      if (o && n) pair = [o, n];
    }
    if (!pair) {
      const cx = (v.clientWidth / 2 - c.x) / c.s - PAD, cy = ((v.clientHeight - 44) / 2 - c.y) / c.s - PAD;
      let best = Infinity;
      for (const n of L.nodes) { const o = was.get(n.id); if (!o) continue; const d = (o.x - cx) ** 2 + (o.y - cy) ** 2; if (d < best) { best = d; pair = [o, n]; } }
    }
    M.anchorId = null;
    if (!pair) return;
    const [o, n] = pair;
    if (o.x === n.x && o.y === n.y) return;
    c.x -= (n.x - o.x) * c.s; c.y -= (n.y - o.y) * c.s;
    applyCam(c, false);
  }

  // ── cursors ─────────────────────────────────────────────────────────────────
  /** Where an agent is, as a box: the file it's on, else a file or folder its command names, else the last file it was on. */
  function spotOf(a, ids, rootId) {
    if (M.scope.kind === "all") return ids.has(a.node) ? a.node : null;
    const within = (p) => { let q = p; while (q) { if (ids.has(q)) return { id: q, exact: q === p }; q = parentOf(q); } return null; };
    const tries = [a.path, ...[...(a.spots || [])].reverse(), a.busy ? a.prev : null].filter(Boolean);
    let near = null;
    for (const p of tries) { const r = within(p); if (r && r.exact) return r.id; if (r && !near) near = r; }
    return near ? near.id : rootId;
  }
  /** Each agent's cursor, keyed, so it glides (CSS) from where it was to where it is. place(id) → {x, y, cx, cy}. */
  function cursors(ags, place) {
    const box = el.querySelector(".dg-curs");
    if (!box) return;
    const seen = new Set(), stack = new Map(), share = new Map();
    for (const a of ags) if (a.nid != null) share.set(a.nid, (share.get(a.nid) || 0) + 1);
    M.lead = null;
    for (const a of ags) {
      const p = a.nid != null ? place(a.nid) : null;
      if (!p) continue;
      const i = stack.get(a.nid) || 0; stack.set(a.nid, i + 1);
      // a second agent on the same box sits beside the first, on the same row; on the graph's small dots
      // they stack as a deck behind the first instead (a row there runs into the labels)
      const x = p.deck ? p.x + i * 4 : p.x + (p.side === "left" ? -i : i) * 18, y = p.deck ? p.y + i * 4 : p.y;
      seen.add(a.id);
      let c = M.curs.get(a.id);
      const more = i === 0 ? (share.get(a.nid) || 1) - 1 : 0;
      const tag = `<span>${esc(verbOf(a))}</span>${more ? `<i class="dg-more">+${more}</i>` : ""}`;
      if (!c || !c.el.isConnected) {
        const d = document.createElement("div");
        d.className = "dg-cur is-new";
        d.dataset.k = a.id;
        d.innerHTML = `${ARROW}<button type="button" class="dg-tag" data-mp-go="${esc(a.go)}" title="${esc(a.coord ? "Open the conversation" : "Open the thread")}"></button>`;
        d.style.transform = `translate(${x}px,${y}px)`;
        box.appendChild(d);
        c = { el: d, node: null, tag: "" };
        M.curs.set(a.id, c);
        requestAnimationFrame(() => d.classList.remove("is-new"));
      }
      c.el.style.setProperty("--c", a.color);
      c.el.classList.toggle("is-idle", !a.busy);
      c.el.classList.toggle("is-wait", a.waiting);
      c.el.classList.toggle("is-stacked", i > 0);
      c.el.style.zIndex = p.deck ? String(9 - Math.min(i, 8)) : "";
      c.el.classList.toggle("is-left", p.side === "left");
      c.el.classList.toggle("is-below", p.side === "below"); // its name is in the first one's "+N" and in the chips above
      const to = `translate(${x}px,${y}px)`;
      if (c.node === a.nid && c.el.style.transform !== to) {
        // same box, moved by the drawing: jump with it, no glide
        c.el.style.transition = "none"; c.el.style.transform = to; void c.el.offsetWidth; c.el.style.transition = "";
      } else c.el.style.transform = to;
      if (c.tag !== tag) { c.el.querySelector(".dg-tag").innerHTML = tag; c.tag = tag; }
      if (c.node !== a.nid) {
        // it landed somewhere new: the box answers once, in its colour
        if (c.node != null) { const b = el.querySelector(`[data-node="${CSS.escape(a.nid)}"]`); if (b) { b.style.setProperty("--c", a.color); b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit"); } }
        c.node = a.nid;
      }
      if (!M.lead && a.busy) M.leadNode = a.nid;
      if (!M.lead && a.busy) M.lead = { key: `${a.id}@${a.nid}`, pt: { x: p.cx - (p.side === "left" ? tagW() : p.side === "below" ? tagW() / 2 : 0), y: p.cy } }; // centring takes its name in too
    }
    for (const [k, c] of M.curs) if (!seen.has(k)) { c.el.classList.add("is-gone"); setTimeout(() => c.el.remove(), 320); M.curs.delete(k); }
  }

  // ── the graph: the same boxes as a living node graph that settles ───────────
  const RAD = { root: 11, project: 8, dir: 6, file: 3.6, more: 3, note: 2.5 };
  const LINK = { root: 0, project: 120, dir: 96, file: 50, more: 40, note: 30 };
  function gnodeHtml(n, at) {
    const here = at.get(n.id);
    const cls = `gn k-${n.kind}${n.mark ? ` m-${n.mark}` : ""}${here ? " is-here" : ""}${n.open ? " is-open" : ""}`;
    const clickable = M.refs.has(n.id);
    const label = n.kind === "dir" ? `${n.name}, folder, ${n.open ? "open" : "folded"}` : n.title || n.name;
    const fc = n.kind === "file" ? fileColor(n.name) : null; // a file's dot in its own colour
    const inner = `<i class="gn-d" style="--r:${RAD[n.kind] || 4}px${fc ? `;--fc:${fc}` : ""}"></i><span class="gn-l">${esc(n.name)}</span>`;
    return clickable ? `<button type="button" class="${cls}" data-node="${esc(n.id)}" aria-label="${esc(label)}" title="${esc(n.title || n.id || n.name)}"${here ? ` style="--c:${here}"` : ""}>${inner}</button>`
      : `<div class="${cls}" data-node="${esc(n.id)}"${here ? ` style="--c:${here}"` : ""}>${inner}</div>`;
  }
  function paintGraph(scope, flat, ags, at) {
    if (!M.gpos.has(scope.key)) M.gpos.set(scope.key, new Map());
    const pos = M.gpos.get(scope.key);
    const nodes = el.querySelector(".dg-nodes"), svg = el.querySelector(".dg-edges");
    const html = flat.map((n) => gnodeHtml(n, at)).join("");
    if (html !== M.layoutKey) {
      const shape = flat.map((n) => `${n.id}<${n.parent}`).join("|");
      const a = document.activeElement, fid = a && el.contains(a) ? a.dataset.node : null;
      // new boxes start beside their parent, and the graph wakes up to make room
      for (const n of flat) if (!pos.has(n.id)) {
        const par = n.parent != null ? pos.get(n.parent) : null, ang = Math.random() * Math.PI * 2;
        pos.set(n.id, { x: (par ? par.x : 0) + Math.cos(ang) * 24, y: (par ? par.y : 0) + Math.sin(ang) * 24, vx: 0, vy: 0 });
      }
      nodes.style.width = nodes.style.height = "0px";
      nodes.innerHTML = html;
      svg.setAttribute("width", "1"); svg.setAttribute("height", "1"); svg.removeAttribute("viewBox");
      const byEl = new Map([...nodes.children].map((e) => [e.dataset.node, e]));
      M.gnodes = flat.map((n) => ({ n, p: pos.get(n.id), par: n.parent != null ? pos.get(n.parent) : null, el: byEl.get(n.id) }));
      svg.innerHTML = M.gnodes.filter((g) => g.par).map(() => "<line/>").join("");
      M.gedges = [...svg.children];
      M.layoutKey = html;
      // the first layout settles from scratch; later dots join gently without shaking the rest
      if (shape !== M.gkey) { M.alpha = Math.max(M.alpha, M.gkey ? 0.25 : 0.9); M.gkey = shape; }
      if (fid != null) focusNode(nodes, fid);
    }
    M.gags = ags;
    gdraw();
    if (M.alpha > 0.02) gkick();
  }
  function gstep() {
    const G = M.gnodes, a = M.alpha, n = G.length;
    for (let i = 0; i < n; i++) {
      const p = G[i].p;
      for (let j = i + 1; j < n; j++) {
        const q = G[j].p;
        let dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 > 160000) continue;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const f = (2300 * a) / d2, d = Math.sqrt(d2);
        p.vx -= (dx / d) * f; p.vy -= (dy / d) * f; q.vx += (dx / d) * f; q.vy += (dy / d) * f;
      }
    }
    for (const g of G) {
      if (!g.par) continue;
      const dx = g.p.x - g.par.x, dy = g.p.y - g.par.y, d = Math.hypot(dx, dy) || 1;
      const k = ((d - (LINK[g.n.kind] || 40)) / d) * 0.25 * a;
      g.p.vx -= dx * k; g.p.vy -= dy * k; g.par.vx += dx * k * 0.3; g.par.vy += dy * k * 0.3;
    }
    for (const g of G) {
      const p = g.p;
      if (g.n.kind === "root") { p.x = 0; p.y = 0; p.vx = p.vy = 0; continue; }
      p.vx -= p.x * 0.004 * a; p.vy -= p.y * 0.004 * a;
      p.vx = clamp(p.vx * 0.58, -24, 24); p.vy = clamp(p.vy * 0.58, -24, 24);
      p.x += p.vx; p.y += p.vy;
    }
    gcollide(G);
  }
  /**
   * Nothing on the graph may sit on anything else (the owner, 4 Nov: a node half covering another).
   * Dots alone repel like charges, which keeps them apart but lets a name run over a neighbour; so after
   * each step every pair of boxes (a dot and, where it shows, its name, plus a 6 px gap) that still
   * overlap is pushed apart along the shorter way out. The root stays put; the other moves for it.
   */
  const GAP = 6;
  function gbox(g) {
    const r = RAD[g.n.kind] || 4, named = g.n.kind === "root" || g.n.kind === "project" || g.n.kind === "dir";
    const e = named && g.ext ? g.ext : { l: -r, t: -r, r, b: r };
    return { l: g.p.x + e.l - GAP / 2, t: g.p.y + e.t - GAP / 2, r: g.p.x + e.r + GAP / 2, b: g.p.y + e.b + GAP / 2 };
  }
  function gcollide(G) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < G.length; i++) {
        for (let j = i + 1; j < G.length; j++) {
          const A = gbox(G[i]), B = gbox(G[j]);
          const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
          if (ox <= 0 || oy <= 0) continue;
          const p = G[i].p, q = G[j].p, ri = G[i].n.kind === "root", rj = G[j].n.kind === "root";
          const wi = ri ? 0 : rj ? 1 : 0.5, wj = rj ? 0 : ri ? 1 : 0.5;
          if (ox < oy) { const d = (A.l + A.r < B.l + B.r ? -1 : 1) * ox; p.x += d * wi; q.x -= d * wj; }
          else { const d = (A.t + A.b < B.t + B.b ? -1 : 1) * oy; p.y += d * wi; q.y -= d * wj; }
        }
      }
    }
  }
  function gdraw() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of M.gnodes) {
      const { x, y } = g.p;
      if (g.el) g.el.style.transform = `translate(${x}px,${y}px)`;
      // a node is its dot and its name: measure the box once it's laid out (names don't change), so
      // "fit it all" fits the names too, not only the dots
      if (g.el && !g.ext && g.el.offsetWidth) { const cs = getComputedStyle(g.el); const ml = parseFloat(cs.marginLeft) || 0, mt = parseFloat(cs.marginTop) || 0; g.ext = { l: ml, t: mt, r: ml + g.el.offsetWidth, b: mt + g.el.offsetHeight }; }
      const e = g.ext || { l: -8, t: -8, r: 8, b: 8 };
      if (x + e.l < x0) x0 = x + e.l; if (y + e.t < y0) y0 = y + e.t; if (x + e.r > x1) x1 = x + e.r; if (y + e.b > y1) y1 = y + e.b;
    }
    let i = 0;
    for (const g of M.gnodes) {
      if (!g.par) continue;
      const e = M.gedges[i++];
      if (!e) continue;
      e.setAttribute("x1", g.par.x); e.setAttribute("y1", g.par.y); e.setAttribute("x2", g.p.x); e.setAttribute("y2", g.p.y);
      const lit = M.glit.get(g.n.id);
      e.setAttribute("class", lit ? "is-lit" : g.n.kind === "file" ? "k-file" : "");
      e.style.stroke = lit || "";
    }
    // a quiet margin all round; a cursor's name tag only when an agent is in the drawing
    const tag = M.gags && M.gags.length ? tagW() * 0.6 : 0;
    if (M.gnodes.length) { M.bounds = { x0: x0 - 12, y0: y0 - 12, x1: x1 + 12 + tag, y1: y1 + 12 }; M.rootPt = { x: 0, y: 0 }; }
    const at = new Map(M.gnodes.map((g) => [g.n.id, g]));
    cursors(M.gags, (id) => { const g = at.get(id); if (!g) return null; const r = RAD[g.n.kind] || 4; return { x: g.p.x + r * 0.55, y: g.p.y + r * 0.55, cx: g.p.x, cy: g.p.y, deck: true }; });
  }
  function gkick() {
    if (M.raf) return;
    const loop = () => {
      M.raf = 0;
      if (!M.open || M.mode !== "graph" || (!M.hosted && viewer && viewer.isOpen) || !M.gnodes.length) return;
      gstep(); gstep();
      M.alpha *= 0.975;
      gdraw();
      const c = M.scope && camOf(M.scope);
      if (c) frame(c);
      if (M.alpha > 0.02) M.raf = requestAnimationFrame(loop);
    };
    M.raf = requestAnimationFrame(loop);
  }

  // ── the panel ────────────────────────────────────────────────────────────────
  function headHtml(scope, ags) {
    let title, sub, ic, extra = "";
    if (scope.kind === "thread") {
      const t = scope.t, a = ags[0];
      title = t.title; ic = ICON.thread;
      sub = [t.branch && `<span class="mp-br">${ICON.branch}<code>${esc(t.branch)}</code></span>`, scope.fold ? (scope.fold.base ? "its own worktree" : "the project folder") : ""].filter(Boolean).join(`<span class="mp-sep">·</span>`);
      const word = a.busy ? (a.waiting ? "Waiting for you" : doingLine(a)) : t.state === "done" ? "Done" : t.state === "resolved" ? "Resolved" : t.state === "failed" ? "Stopped" : "Not working right now";
      extra = `<div class="mp-now st-${a.busy ? (a.waiting ? "wait" : "busy") : "rest"}" style="--c:${a.color}"><p class="mp-nl">${word}</p>${a.busy ? since(a.since) : ""}</div>`;
    } else {
      if (scope.kind === "project") { title = (world.project(scope.pid) || {}).name || scope.pid; ic = ICON.project; }
      else { title = "Working now"; ic = MAP_ICON; }
      const n = ags.length;
      sub = n ? `${n} agent${n === 1 ? "" : "s"} at work` : scope.kind === "project" ? "No agent is working here right now" : "No agent is working right now";
      if (n) extra = `<ul class="mp-legend" aria-label="Agents">${ags.map((a) => `<li><button type="button" class="mp-who" data-mp-focus="${esc(a.id)}" style="--c:${a.color}" title="Show where it is"><i aria-hidden="true"></i><b>${esc(a.title)}</b><span>${esc(verbOf(a))}</span></button></li>`).join("")}</ul>`;
    }
    // in a host's panel the host owns the tabs, Full size and Close
    const chrome = M.hosted ? "" : `<button type="button" class="mp-x mp-full" data-mp-full aria-pressed="${M.full}" aria-label="${M.full ? "Back beside the conversation" : "Full size"}" title="${M.full ? "Back beside the conversation" : "Full size"}">${M.full ? TOOL.unfull : TOOL.full}</button>` +
      `<button type="button" class="mp-x" data-mp-close aria-label="Close the map" title="Close">${ICON.close}</button>`;
    return (M.hosted ? "" : tabs("live")) + `<header class="mp-top">${M.hosted ? "" : `<span class="mp-hic" aria-hidden="true">${ic}</span>`}<div class="mp-t"><h2 id="mp-h">${esc(title)}</h2>${sub ? `<p class="mp-sub">${sub}</p>` : ""}</div>` +
      chrome + `</header>` + extra;
  }

  /** Draw what changed: the head as words, the boxes when the drawing changes, the cursors always (they glide). */
  function paint() {
    if (!M.open || !el || (!M.hosted && viewer && viewer.isOpen)) return; // under the viewer nothing moves, so focus comes back to the box it left
    const scope = scopeOf(M.view);
    // a different thread or project (or view): it gets its own first look
    const sk = scope.key + "|" + M.mode;
    if (M.lastScope !== sk) { M.lastScope = sk; reframe(scope); }
    M.scope = scope;
    if (el.dataset.scope !== scope.key + "|" + M.mode || !view()) skeleton(scope);
    // who, and where
    let ags, tree, marks = new Map();
    M.refs = new Map();
    if (scope.kind === "thread") {
      ags = [agentOf(scope.t)];
      marks = ags[0].act.files;
    } else ags = agentsIn(scope.kind === "project" ? scope.pid : null);
    if (scope.kind === "all") tree = projectsTree(ags);
    else if (scope.fold) {
      const hot = new Set(ags.filter((a) => scope.kind === "thread" || a.fold).flatMap((a) => [a.path, ...(a.spots || []), a.busy ? a.prev : null]).filter(Boolean));
      tree = folderTree(scope, scope.fold, marks, hot, true);
      // the first look must show the whole drawing, readable: if unfolding by itself would make it wider
      // or taller than the canvas at a readable size, those folders stay folded (yours stay as you left them).
      // Decided once per place, on its first look: measuring the canvas on every paint forced the page's layout
      // in the middle of a change (Launchpad folding with a long thread and a diff open: ~150 ms at 4×)
      const v = view();
      if (M.mode === "tree" && M.fit?.key !== sk && v && v.clientWidth) {
        const L = layoutOf(tree);
        M.fit = { key: sk, fold: (L.w + PAD * 2 + tagW()) * READABLE > v.clientWidth - 24 || (L.h + PAD * 2) * READABLE > v.clientHeight - 44 - 24 };
      }
      if (M.mode === "tree" && M.fit?.key === sk && M.fit.fold) { M.refs = new Map(); tree = folderTree(scope, scope.fold, marks, hot, false); }
    }
    else tree = { id: "", kind: "root", name: scope.t.title, sub: "its folder isn't one XO can show", children: [] };
    // head
    const h = headHtml(scope, ags);
    if (h !== M.head) {
      const hd = el.querySelector("[data-mp-head]");
      const a = document.activeElement, fid = a && hd.contains(a) ? a.dataset.mpFocus || a.dataset.mpGo : null;
      hd.innerHTML = h; M.head = h;
      for (const x of hd.querySelectorAll(".elapsed[data-since]")) x.textContent = elapsed(Math.max(0, Math.floor((Date.now() - +x.dataset.since) / 1000)));
      if (fid) hd.querySelector(`[data-mp-focus="${CSS.escape(fid)}"]`)?.focus({ preventScroll: true });
    }
    // the drawing: every box, its parent, and where each agent is
    const flat = [];
    const walk = (n, parent) => { flat.push({ ...n, parent }); for (const c of n.children || []) walk(c, n.id); };
    walk(tree, null);
    const ids = new Set(flat.map((n) => n.id)), parentById = new Map(flat.map((n) => [n.id, n.parent]));
    for (const a of ags) a.nid = spotOf(a, ids, tree.id);
    const at = new Map(), lit = new Map();
    for (const a of ags) {
      if (!a.busy || a.nid == null) continue;
      if (!at.has(a.nid)) at.set(a.nid, a.color);
      // the way down to it, lit in its colour
      for (let id = a.nid; id != null && parentById.get(id) != null; id = parentById.get(id)) if (!lit.has(id)) lit.set(id, a.color);
    }
    M.glit = lit;
    M.loading = flat.some((n) => n.kind === "note" && !n.btn && n.name === "Reading…");
    if (M.mode === "graph") paintGraph(scope, flat, ags, at);
    else {
      const L = layoutOf(tree), old = M.layout;
      M.layout = L;
      const byId = new Map(L.nodes.map((n) => [n.id, n]));
      // a cursor's name goes where its box has room that nothing else uses:
      //   · the right of a file or a folded folder (nothing else shares a leaf's row);
      //   · under the top box (its column holds nothing else), so it never widens the drawing;
      //   · the left of an open folder (its children are on the right, one on its row), unless its parent
      //     sits on that same row.
      const parentOfId = new Map(L.edges.map((e) => [e.to.id, e.from]));
      const sideOf = (n) => {
        if (!(n.children && n.children.length)) return "right";
        const par = parentOfId.get(n.id);
        if (!par) return "below";
        return par.y === n.y ? "right" : "left";
      };
      let x0 = 0, x1 = L.w + PAD * 2, y1 = L.h + PAD * 2;
      for (const a of ags) {
        const n = a.nid != null && byId.get(a.nid);
        if (!n) continue;
        const side = sideOf(n);
        if (side === "left") x0 = Math.min(x0, n.x + PAD - tagW());
        else if (side === "right") x1 = Math.max(x1, n.x + PAD + NW + tagW());
        else y1 = Math.max(y1, n.y + PAD + NH + 44);
      }
      M.bounds = { x0, y0: 0, x1, y1 };
      const rn = byId.get(tree.id);
      M.rootPt = rn ? { x: rn.x + PAD, y: rn.y + PAD + NH / 2 } : null;
      const nodesHtml = L.nodes.map((n) => boxHtml(n, at)).join("");
      const key = `${L.w}x${L.h}|${nodesHtml}|${[...lit].join()}`;
      if (key !== M.layoutKey) {
        const a = document.activeElement, fid = a && el.contains(a) ? a.dataset.node : null;
        const W = L.w + PAD * 2, H = L.h + PAD * 2;
        const svg = el.querySelector(".dg-edges");
        svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.innerHTML = `<g transform="translate(${PAD} ${PAD})">${L.edges.map((e) => { const c = lit.get(e.to.id); return `<path d="${edgePath(e.from, e.to)}"${c ? ` class="is-lit" style="stroke:${c}"` : ""}/>`; }).join("")}</g>`;
        const nodes = el.querySelector(".dg-nodes");
        nodes.style.width = W + "px"; nodes.style.height = H + "px";
        nodes.innerHTML = nodesHtml;
        M.layoutKey = key;
        if (old) holdStill(scope, old, L);
        // the focused node again; if it's gone (a folder's "Try again" becomes the folder once it reads), the
        // nearest node above it, else the drawing: never the page (Astra S082)
        if (fid != null) focusNode(nodes, fid);
      }
      cursors(ags, (id) => {
        const n = byId.get(id);
        if (!n) return null;
        let side = sideOf(n);
        // a name that would run off the canvas's right edge goes on the box's left instead
        if (side === "right") {
          const c = camOf(scope), v = view();
          if (v && v.clientWidth && c.x + (n.x + PAD + NW + 2 + tagW()) * c.s > v.clientWidth - 8) side = "left";
        }
        return { x: side === "left" ? n.x + PAD + 10 : n.x + PAD + NW + 2, y: n.y + PAD + 9, cx: n.x + PAD + NW / 2, cy: n.y + PAD + NH / 2, side };
      });
    }
    // what the marks mean, when there are some
    const kd = el.querySelector("[data-dg-key]");
    const kinds = new Set([...marks.values()].map((m) => m.mark).filter((m) => m !== "read"));
    const kh = kinds.size ? ["new", "edited", "deleted"].filter((k) => kinds.has(k)).map((k) => `<span class="m-${k}"><i></i>${k}</span>`).join("") : "";
    if (kd && kd._h !== kh) { kd.innerHTML = kh; kd._h = kh; kd.hidden = !kh; }
    frame(camOf(scope));
  }

  /** Is anything in this view's scope working? (the button's live dot) */
  function liveIn(v) {
    const s = scopeOf(v);
    if (s.kind === "thread") return isBusy(s.t);
    if (s.kind === "project") return world.state.threads.some((t) => t.project === s.pid && isBusy(t));
    return world.state.threads.some(isBusy);
  }

  /** The Live · File switch, on whichever mode shows; nothing unless both are there. */
  function tabs(mode) {
    if (M.hosted || !viewer || !M.open || !viewer.hasFile) return "";
    const f = viewer.file || {};
    const name = f.name || base(f.rel || f.path) || "File";
    const live = liveIn(M.view);
    return `<nav class="stage-tabs" aria-label="Right panel"><button type="button" class="st-tab" data-stage="live" aria-pressed="${mode === "live"}" title="Where your agents are working">${MAP_ICON}<span>Live</span></button>` +
      `<span class="st-file"><button type="button" class="st-tab" data-stage="file" aria-pressed="${mode === "file"}" title="${esc(f.where || name)}">${f.image ? ICON.image : ICON.doc}<span>${esc(name)}</span></button>` +
      `<button type="button" class="st-x" data-stage="close-file" aria-label="Close ${esc(name)}" title="Close the file">${ICON.close}</button></span></nav>`;
  }

  function setFull(on) {
    if (M.hosted) return;
    M.full = on;
    document.body.classList.toggle("map-full", on && M.open);
    M.head = "";
    const c = M.scope && camOf(M.scope);
    paint();
    // the canvas changed size: frame it again once it has
    if (c) requestAnimationFrame(() => frame(c));
  }

  function setOpen(on, { focus = true } = {}) {
    if (M.hosted || !el) return; // in the panel, the panel opens and closes it
    M.open = on;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
    document.body.classList.toggle("map-open", on);
    document.body.classList.toggle("map-full", on && M.full);
    el.hidden = !on;
    if (on) {
      if (viewer && viewer.isOpen) viewer.park(); // one panel: Live comes forward, the file waits behind its tab
      el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in");
      el.dataset.scope = ""; M.lastScope = null;
      paint();
      if (focus) (view() || el).focus({ preventScroll: true });
      announce("The map is open: where your agents are working.");
    } else {
      el.innerHTML = ""; el.dataset.scope = "";
      if (viewer && viewer.isParked) viewer.close({ restore: false }); // closing the panel closes all of it
      else if (viewer) viewer.refresh();
      announce("Map closed.");
    }
    onChange && onChange();
  }

  // ── input ──────────────────────────────────────────────────────────────────
  const bound = new WeakSet();
  function bind(node) {
  if (!node || bound.has(node)) return;
  bound.add(node);
  node.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-mp-close]")) { close(); return; }
    if (t.closest("[data-mp-full]")) { setFull(!M.full); return; }
    const tl = t.closest("[data-dg]");
    if (tl && tl.dataset.dg) { tool(tl.dataset.dg); return; }
    const g = t.closest("[data-mp-go]");
    if (g) { go(g.dataset.mpGo); return; }
    const fc = t.closest("[data-mp-focus]");
    if (fc) {
      const c = camOf(M.scope), cur = M.curs.get(fc.dataset.mpFocus);
      if (cur) {
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(cur.el.style.transform);
        if (m) { c.user = true; c.follow = false; c.fitAll = false; centerOn(c, { x: +m[1], y: +m[2] }, true, Math.max(c.s, 0.9)); }
        cur.el.classList.remove("is-ping"); void cur.el.offsetWidth; cur.el.classList.add("is-ping");
      }
      return;
    }
    const nb = t.closest("[data-node]");
    if (!nb || M.dragged) return;
    const r = M.refs.get(nb.dataset.node);
    if (!r) return;
    const cz = camOf(M.scope);
    if (e.detail > 0 && cz.s < PRESS_MIN) {
      // a pointer press far out: in to that box, readable, where its targets are full size; it doesn't act yet
      cz.user = true; cz.follow = false; cz.fitAll = false;
      centerOn(cz, { x: nb.offsetLeft + nb.offsetWidth / 2 - tagW() / 2, y: nb.offsetTop + nb.offsetHeight / 2 }, true, READABLE);
      announce(`Closer to ${nb.textContent.trim() || "it"}: press it again to open it.`);
      return;
    }
    const key = M.scope.key;
    if (r.toggle != null || r.more != null) {
      // unfold in place: the box you clicked stays under your pointer, at the same size
      const c = camOf(M.scope);
      M.anchorId = nb.dataset.node;
      c.user = true;
      if (r.more != null) setOf(M.more, key).add(r.more);
      else {
        const opened = setOf(M.opened, key), closed = setOf(M.closed, key);
        if (r.open) { opened.delete(r.toggle); closed.add(r.toggle); } else { closed.delete(r.toggle); opened.add(r.toggle); }
      }
      paint();
    }
    else if (r.retry != null) load(r.fold, r.retry, { again: true });
    else if (r.go) go(r.go);
    else if (r.open) (openFile ? openFile(r.open, nb) : viewer && viewer.open(r.open, nb));
  });
  // the Live · File switch, drawn on the Map and on the viewer alike
  document.addEventListener("click", (e) => {
    const s = e.target.closest?.("[data-stage]");
    if (!s || M.hosted || !viewer) return;
    const what = s.dataset.stage;
    if (what === "live") { viewer.park(); M.head = ""; paint(); (view() || el).focus({ preventScroll: true }); }
    else if (what === "file") viewer.unpark();
    else if (what === "close-file") { viewer.close({ restore: false }); M.head = ""; paint(); (view() || el).focus({ preventScroll: true }); }
  });
  node.addEventListener("keydown", (e) => {
    if (M.hosted) return; // the host decides what Esc does
    if (e.key === "Escape" && !(viewer && viewer.isOpen)) { e.preventDefault(); e.stopPropagation(); if (M.full) setFull(false); else close(); }
  });
  // the panel's size changes with the window: frame it again unless you've moved it
  if (typeof ResizeObserver === "function") {
    let w0 = 0, h0 = 0;
    new ResizeObserver(() => {
      const v = view();
      if (!M.open || !v || !M.scope) return;
      const w = v.clientWidth, h = v.clientHeight;
      if (w === w0 && h === h0) return;
      const was = w0; w0 = w; h0 = h;
      const c = camOf(M.scope);
      if (was && c.fitAll) { fit(c, false, true); return; } // you asked to see it all: keep it all in view
      if (was && !c.user) { c.done = false; c.settleUntil = 0; c.target = null; } // the frame changed size: a fresh fit
      frame(c);
    }).observe(node);
  }
  }
  bind(el);

  function close() {
    if (!M.open || M.hosted) return;
    const back = document.querySelector("[data-map-toggle]");
    if (M.full) { M.full = false; document.body.classList.remove("map-full"); }
    setOpen(false);
    back?.focus({ preventScroll: true });
  }


  return {
    /** Standalone #map is open (always false in the panel: the panel answers that). */
    get isOpen() { return M.open && !M.hosted; },
    // ── in the right panel ──
    /**
     * Draw only inside `host` (the Map tab's body; give it a height). Either shape works: mount once and
     * show()/hide() with the tab, or mount() each time the tab shows and unmount() when it hides. A host
     * that's on screen when mounted is painted at once; a hidden one waits for show().
     */
    mount(host) {
      if (!host) return;
      if (el !== host || !M.hosted) {
        // the standalone #map, if it had already reopened itself, steps aside for good
        if (!M.hosted && M.open && el && el !== host) { el.hidden = true; el.innerHTML = ""; document.body.classList.remove("map-open", "map-full"); }
        M.hosted = true; M.full = false; M.open = false;
        el = host; bind(host);
        host.classList.add("map-host");
        el.dataset.scope = ""; M.head = "";
      }
      if (host.isConnected && host.getClientRects().length) this.show();
    },
    /** The tab became visible: start painting and frame the camera. Shown again on the same place with its
     *  drawing still there (the panel lays its frames out again, a fold opens, Launchpad folds), it carries on
     *  from that drawing: paint draws only what changed, and the camera stays where it was. A new place, or
     *  no drawing yet, starts fresh. Called while already showing, it only paints. */
    show(v) {
      if (!el) return;
      const was = M.open;
      if (v) M.view = v;
      M.open = true;
      if (!view() || el.dataset.scope !== scopeOf(M.view).key + "|" + M.mode) { el.dataset.scope = ""; M.lastScope = null; }
      if (!was) M.head = "";
      paint();
      const c = M.scope && camOf(M.scope);
      if (c && !was) requestAnimationFrame(() => { paint(); frame(c); }); // its size may have changed while hidden
    },
    /** The tab was hidden or the panel closed: stop the heavy work (the graph stops), keep camera and folds. */
    hide() { M.open = false; if (M.raf) { cancelAnimationFrame(M.raf); M.raf = 0; } },
    /** The same as hide(), for a host that mounts each time the tab shows. */
    unmount() { this.hide(); },
    /** Agents at work in this view's scope: the tab's dot and the header button's dot. */
    live: (v) => liveIn(v),
    /** Who is at work in a view's scope, in plain words, for the panel's Agents frame. */
    agents(v) {
      const s = scopeOf(v || M.view);
      const list = s.kind === "thread" ? [agentOf(s.t)] : agentsIn(s.kind === "project" ? s.pid : null);
      return list.map((a) => ({ id: a.id, title: a.title, go: a.go, busy: a.busy, waiting: a.waiting, color: a.color, since: a.since,
        doing: a.waiting ? "waiting for you" : `${verbOf(a)}${a.liveFile ? ` ${a.liveFile.path.split("/").pop()}` : ""}` }));
    },
    /** The drawing: "tree" (the diagram) or "graph". */
    get mode() { return M.mode; },
    setMode: (m) => tool(m, { focus: false }),
    liveIn: (v) => liveIn(v),

    // ── standalone (#map), until the panel lands ──
    /** The header's Map button: shows Live (parking a file in front of it), or closes the panel. */
    toggle: () => (M.open && viewer && viewer.isOpen ? (viewer.park(), (M.head = ""), paint(), (view() || el).focus({ preventScroll: true })) : M.open ? close() : setOpen(true)),
    tabs,
    open: () => setOpen(true),
    close,
    /** The view changed or the world moved: follow it. */
    render(v) {
      if (v !== M.view) M.view = v;
      // standalone: reopen #map as it was, unless a panel mounted the Map first
      if (!M.hosted && !M.restored) { M.restored = true; if (saved && el) { setOpen(true, { focus: false }); return; } }
      paint();
    },
    /** The header's toggle, for any conversation view. */
    button(v) {
      const live = liveIn(v);
      return `<button type="button" class="map-btn${M.open ? " is-on" : ""}" data-map-toggle aria-pressed="${M.open}" aria-controls="map" title="Map: where your agents are working">${MAP_ICON}<span>Map</span></button>`;
    },
  };
}
