// The Map: where your agents are working, drawn. One button (top right of every conversation, ⌘\)
// opens it beside the conversation; it follows the view you're on:
//   · a thread: its folder (its own worktree) drawn as a diagram, boxes and connectors, and its agent as
//     a cursor that glides from file to file as it reads and edits. What it made or changed is marked.
//   · a project: the project's folder, with every agent working in it as its own coloured cursor.
//   · Home, the Workspace, Chats: your projects, with the agents at work in them.
// Drag (or scroll) to pan, ⌘/Ctrl-scroll or pinch to zoom; Fit and Follow. A box opens what it is: a
// folder unfolds, a file opens in the viewer, a project or an agent's name goes there. It draws in the
// right panel's Map frame (js/stage.js), which owns its fold, its size and its full-size mode.
//
// What it reads: the turns the stream already brings (storm's activity rows: kind, target, status),
// and GET /api/xo-projects/<project>/tree (one level per call; it serves a thread's worktree under
// `.xo/worktrees/<name>` too). Nothing here writes.

import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { api } from "../core/platform/api.js";
import { elapsed } from "../core/platform/index.js";
import { stepLineHtml } from "./turnview.js";
import { redraw } from "./redraw.js";
import { folderOf } from "../core/services/places.js";
import { heldWords } from "../core/services/world/held.js";
import { NW, NH, PAD, layoutOf, edgePath } from "../modules/map/layout.js";
import { MAP_ICON, TOOL } from "../modules/map/icons.js";
import { afterPause } from "../modules/map/after-pause.js";
import { createMapFolders } from "../modules/map/folders.js";
import { createMapAgents } from "../modules/map/agents.js";
import { createMapTree, setOf } from "../modules/map/tree.js";
import { createMapCamera, READABLE } from "../modules/map/camera.js";
import { createMapDrawing } from "../modules/map/drawing.js";

export { MAP_ICON };
const MODE_KEY = "cv-map-mode";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** The Map, in the right panel (js/stage.js): mount(host) once, show(view) / hide() with its frame, render(view) on every app render. */
export function createMap({ world, go, announce, isBusy, openFile }) {
  let el = null;
  const M = {
    open: false, view: "home",
    opened: new Map(),   // scope key → folders you unfolded
    closed: new Map(),   // scope key → folders you folded (even with an agent inside)
    more: new Map(),     // scope key → folders showing every box
    shown: new Map(),    // scope key → boxes that have been on screen (they stay, so nothing reshuffles)
    autoOpen: new Map(), // scope key → folders that unfolded by themselves (kept, unless the panel is too narrow)
    cams: new Map(),     // scope key → {x, y, s, user, follow, target}
    refs: new Map(),     // box id → what a click on it does
    curs: new Map(),     // agent id → its cursor element and where it was
    head: "", layoutKey: "", scope: null, layout: null, dragged: false,
    mode: "graph",       // "graph": a living node graph (the default, the owner 19 Nov); "tree": the diagram
    bounds: null,        // the drawing's extent by its layout (bounds() adds the boxes as drawn), for Fit
    reach: null, reachKey: "", // the drawn boxes' far edges, and the drawing they were measured on
    gpos: new Map(),     // scope key → Map box id → {x, y, vx, vy}: the graph keeps its shape across redraws
    gkey: "", gnodes: [], gedges: [], alpha: 0, raf: 0, gags: [], glit: new Map(),
  };
  try { if (localStorage.getItem(MODE_KEY) === "tree") M.mode = "tree"; } catch { /* private mode */ }
  // a box's words change width when the font arrives: measure the drawing again
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => { M.reachKey = ""; });
  // a cursor is its arrow: what the agent is doing is said once, in the line above the drawing (a
  // thread) or its chip (a project); the arrow's tag shows on hover. So it needs only the arrow's room.
  const tagW = () => 22;

  // ── what's in scope ─────────────────────────────────────────────────────────
  function scopeOf(v) {
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) return { kind: "thread", t, key: v, fold: folderOf(t) }; }
    if (v.startsWith("p:")) return { kind: "project", pid: v.slice(2), key: v, fold: { project: v.slice(2), base: "" } };
    return { kind: "all", key: "all" };
  }
  const { agentOf, agentsIn, doingLine, verbOf } = createMapAgents({ world, isBusy, stepLineHtml });
  const since = (ms) => (Number.isFinite(ms) ? `<span class="elapsed" data-since="${ms}"></span>` : "");

  const { load, get: folderAt } = createMapFolders(api, paint);
  const { folderTree, projectsTree, boxHtml } = createMapTree({ M, world, load, folderAt });


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
    M.head = ""; M.layoutKey = ""; M.reachKey = ""; M.curs = new Map(); M.gkey = ""; M.gnodes = []; M.gedges = [];
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

  const { applyCam, camOf, centerOn, fit, frame, holdStill, keepInView, reframe, zoomAt } =
    createMapCamera({ M, host: () => el, view, world$, tagW, clamp });
  const { spotOf, cursors, paintGraph } = createMapDrawing({ M, host: () => el, verbOf, tagW, focusNode, camOf, frame, clamp });
  // the smallest a press target may be on screen and still be pressed surely. Below the readable scale, a pointer
  // press on a box whose target is smaller than this brings the map in to the box instead of acting on it (the
  // keyboard acts at any size) (Files/Map grader on b153247). Each box by its own target, never one scale for
  // all: a 32 px box (its target grows 5 into the gap each side, css: .dg-n::before) is under it below 24/42, a
  // 24 px "More" below 24/34, a Graph node (16 px, nothing around it) anywhere below the readable scale (the
  // grader on 44e429d: one scale, 24/42, was a 32 px box's, and "More" at 0.6 was 20.4 px and still acted)
  const PRESS_PX = 24;
  // on a phone the floor is 36 px, the app's (css/phone.css, 760 px): a box opens on one tap only from 36 px on screen;
  // below that the first tap brings the map in and the second opens, at any scale (the owner, 9 Nov,
  // rv_49d00670fa4c48c9). A desktop keeps 24 px with a pointer
  const PHONE = typeof matchMedia === "function" ? matchMedia("(max-width:760px)") : null;
  const onPhone = () => !!(PHONE && PHONE.matches);
  const pressMin = () => (onPhone() ? 36 : PRESS_PX);
  /** Too small to press surely at scale s: on a phone under 36 px; on a desktop under 24, below the readable scale for
   *  a box or a node (a Graph node's 16 px acts above it, as before), at any scale for an agent's tag. */
  const tooSmall = (b, s, anyScale = false) => (onPhone() ? pressPx(b, s) < 36 : (anyScale || s < READABLE) && pressPx(b, s) < PRESS_PX);
  /** The scale such a press brings the map in to: readable, and where the target's own size alone reaches the floor
   *  (its grown hit area only adds to that); a desktop's box or node keeps the readable scale, as before. */
  const pressScale = (b, s, anyScale = false) => Math.min(2.4, Math.max(READABLE, ...(onPhone() || anyScale ? [s, pressMin() / Math.max(1, Math.min(b.offsetWidth, b.offsetHeight))] : [])));
  /** How big a box's press target is on screen at scale s: the box, and what its ::before adds around it. */
  function pressPx(nb, s) {
    const b = getComputedStyle(nb, "::before"), hit = b.content !== "none" && b.position === "absolute";
    const grow = (v) => (hit ? Math.max(0, -parseFloat(v) || 0) : 0);
    return Math.min(nb.offsetWidth + 2 * grow(b.left), nb.offsetHeight + 2 * grow(b.top)) * s;
  }
  /** A box's centre in the drawing's own units (the camera's): a Diagram box by its place; a Graph node sits at
   *  0,0 and moves by its transform, so by that (the grader on 44e429d: a far Graph press zoomed in on 0,0). */
  function nodePt(nb) {
    let tx = 0, ty = 0;
    try { if (nb.style.transform) { const m = new DOMMatrixReadOnly(nb.style.transform); tx = m.e; ty = m.f; } } catch { /* no move */ }
    return { x: tx + nb.offsetLeft + nb.offsetWidth / 2, y: ty + nb.offsetTop + nb.offsetHeight / 2 };
  }

  /** Keyboard focus on something in the drawing that's out of the frame: the camera brings it in, 12 px inside (and
   *  clear of the tools), at once, so the browser finds it in view and scrolls nothing. The frame clips without
   *  scrolling (.dg overflow:clip): the camera is the only thing that moves the drawing (the Files/Map grader on
   *  131d146, S208: Tab back to Follow scrolled the frame by itself, scrollTop 121, and the followed arrow was
   *  clipped). Follow stays as it was; leaving the drawing brings the camera back to the agent (wire's focusout). */
  function reveal(t) {
    const v = view();
    if (!v || !v.clientWidth) return;
    const c = camOf(M.scope), b = v.getBoundingClientRect(), r = t.getBoundingClientRect();
    const m = 12, W = v.clientWidth, H = v.clientHeight - 44;
    const x0 = r.left - b.left - v.clientLeft, y0 = r.top - b.top - v.clientTop, x1 = x0 + r.width, y1 = y0 + r.height;
    let dx = 0, dy = 0;
    if (x0 < m || x1 > W - m) dx = x0 < m || x1 - x0 > W - 2 * m ? m - x0 : W - m - x1;
    if (y0 < m || y1 > H - m) dy = y0 < m || y1 - y0 > H - 2 * m ? m - y0 : H - m - y1;
    if (!dx && !dy) return;
    c.x += dx; c.y += dy; c.user = true; c.fitAll = false; applyCam(c, false);
  }
  /** Pan with a drag (a pinch zooms), scroll pans, ⌘/Ctrl-scroll zooms; a drag never counts as a click. */
  function wire(v) {
    const pts = new Map();
    let start = null;
    v.addEventListener("focusin", (e) => { if (e.target !== v && e.target.closest(".dg-world")) reveal(e.target); });
    v.addEventListener("focusout", (e) => {
      const to = e.relatedTarget;
      if (!e.target.closest(".dg-world") || (to && to.closest && to.closest(".dg-world"))) return;
      const c = camOf(M.scope);
      if (c.follow && M.lead) keepInView(c, M.lead);
    });
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
      // Follow is where the camera points, never how near: it pans to keep the agent in view at the zoom you chose.
      // Turning it on or off leaves "you chose this view" as it was, so no update refits under it (Astra S208: it
      // was cleared here, and the next live update Fit away a zoom of 2.4). Following replaces "all of it": Fit
      // again to see it all.
      c.follow = !c.follow;
      if (c.follow) c.fitAll = false;
      if (c.follow && M.lead) { c.target = M.lead.key; centerOn(c, M.lead.pt, true); }
      // the button says it at once, not on the next camera move (Astra S208: it stayed pressed after turning off)
      el.querySelector('[data-dg="follow"]')?.setAttribute("aria-pressed", String(!!c.follow));
      announce(c.follow ? "Following the agent." : "Not following.");
    }
  }



  // ── the panel ────────────────────────────────────────────────────────────────
  function headHtml(scope, ags) {
    let title, sub, extra = "";
    if (scope.kind === "thread") {
      const t = scope.t, a = ags[0];
      title = t.title;
      sub = [t.branch && `<span class="mp-br">${ICON.branch}<code>${esc(t.branch)}</code></span>`, scope.fold ? (scope.fold.base ? "its own worktree" : "the project folder") : ""].filter(Boolean).join(`<span class="mp-sep">·</span>`);
      const word = a.busy ? (a.waiting ? "Waiting for you" : doingLine(a)) : a.held ? esc(heldWords(a.held)) : t.state === "done" ? "Done" : t.state === "resolved" ? "Resolved" : t.state === "failed" ? "Stopped" : "Not working right now";
      extra = `<div class="mp-now st-${a.busy ? (a.waiting ? "wait" : "busy") : a.held ? "wait" : "rest"}" style="--c:${a.color}"><p class="mp-nl">${word}</p>${a.busy ? since(a.since) : ""}</div>`;
    } else {
      if (scope.kind === "project") { title = (world.project(scope.pid) || {}).name || scope.pid; }
      else title = "Working now";
      const n = ags.length;
      sub = n ? `${n} agent${n === 1 ? "" : "s"} at work` : scope.kind === "project" ? "No agent is working here right now" : "No agent is working right now";
      if (n) extra = `<ul class="mp-legend" aria-label="Agents">${ags.map((a) => `<li><button type="button" class="mp-who" data-mp-focus="${esc(a.id)}" style="--c:${a.color}" title="Show where it is"><i aria-hidden="true"></i><b>${esc(a.title)}</b><span>${esc(verbOf(a))}</span></button></li>`).join("")}</ul>`;
    }
    return `<header class="mp-top"><div class="mp-t"><h2 id="mp-h">${esc(title)}</h2>${sub ? `<p class="mp-sub">${sub}</p>` : ""}</div></header>` + extra;
  }

  /** Draw what changed: the head as words, the boxes when the drawing changes, the cursors always (they glide). */
  function paint() {
    if (!M.open || !el || M.waking) return;
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
      redraw(hd, h); M.head = h; // in place: the legend's buttons stay the same nodes as the agents' verbs change
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
        // in place, keyed by data-node: an agent moving file changes a box's class and colour, not the boxes, so a
        // press on one still clicks (a box drawn anew mid-press took the pressed node with it: the owner, 19 Nov)
        redraw(nodes, nodesHtml);
        M.layoutKey = key;
        if (old) holdStill(scope, old, L);
        // the focused node again; if it's gone (a folder's "Try again" becomes the folder once it reads), the
        // nearest node above it, else the drawing: never the page (Astra S082)
        if (fid != null) focusNode(nodes, fid);
      }
      // read first, then write: the canvas is measured once, before the cursors are written (a read per cursor between
      // their writes laid the page out again for each one)
      const cam = camOf(scope), vw = view()?.clientWidth || 0, tw = tagW();
      cursors(ags, (id) => {
        const n = byId.get(id);
        if (!n) return null;
        let side = sideOf(n);
        // a name that would run off the canvas's right edge goes on the box's left instead
        if (side === "right" && vw && cam.x + (n.x + PAD + NW + 2 + tw) * cam.s > vw - 8) side = "left";
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

  // ── input ──────────────────────────────────────────────────────────────────
  const bound = new WeakSet();
  function bind(node) {
  if (!node || bound.has(node)) return;
  bound.add(node);
  node.addEventListener("click", (e) => {
    const t = e.target;
    const tl = t.closest("[data-dg]");
    if (tl && tl.dataset.dg) { tool(tl.dataset.dg); return; }
    const g = t.closest("[data-mp-go]");
    if (g) {
      // the agent's tag shrinks with the drawing like a box: a pointer press on it too small to press surely brings
      // the map in to it, and doesn't act; pressed again, it opens (the owner's Map choice, 9 Nov 18:02; the controls
      // grader on e55c2d8, S083: 43 × 14.8 px, and it opened on the first tap). The keyboard acts at any size
      const cg = camOf(M.scope), cur = g.closest(".dg-cur");
      const m = cur && /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(cur.style.transform);
      if (e.detail > 0 && m && tooSmall(g, cg.s, true)) {
        cg.user = true; cg.follow = false; cg.fitAll = false;
        centerOn(cg, { x: +m[1], y: +m[2] }, true, pressScale(g, cg.s, true));
        announce(`Closer to ${g.textContent.trim() || "it"}: press it again to open it.`);
        return;
      }
      go(g.dataset.mpGo); return;
    }
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
    if (e.detail > 0 && tooSmall(nb, cz.s)) {
      // a pointer press far out on a target too small to press surely: in to that box, readable, where its target
      // is full size (on a phone, 36 px); it doesn't act yet
      cz.user = true; cz.follow = false; cz.fitAll = false;
      const pt = nodePt(nb);
      centerOn(cz, { x: pt.x - tagW() / 2, y: pt.y }, true, pressScale(nb, cz.s));
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
    else if (r.open) openFile(r.open, nb);
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

  return {
    /**
     * Draw only inside `host` (the Map tab's body; give it a height). Either shape works: mount once and
     * show()/hide() with the tab, or mount() each time the tab shows and unmount() when it hides. A host
     * that's on screen when mounted is painted at once; a hidden one waits for show().
     */
    mount(host) {
      if (!host) return;
      if (el !== host) {
        M.open = false;
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
      if (was) { paint(); return; }
      // coming back (the panel returning as a file is put away): the panel's frame shows at once with the drawing as it
      // was; the Map draws again once that switch has painted and your hands are still, not in the click that brought
      // it (the owner, 19 Nov 12:06Z: "back to the chat … seems to have a lag": the Map's redraw was ~30 of the click's
      // whole-page style passes)
      M.head = "";
      M.waking = true;
      const my = (M.wakeGen = (M.wakeGen || 0) + 1);
      afterPause(() => {
        if (my !== M.wakeGen || !M.open) return;
        M.waking = false;
        paint();
        const c = M.scope && camOf(M.scope);
        if (c) requestAnimationFrame(() => { if (M.open && !M.waking) { paint(); frame(c); } }); // its size may have changed while hidden
      });
    },
    /** The tab was hidden or the panel closed: stop the heavy work (the graph stops), keep camera and folds. */
    hide() { M.open = false; M.waking = false; M.wakeGen = (M.wakeGen || 0) + 1; if (M.raf) { cancelAnimationFrame(M.raf); M.raf = 0; } },
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
    /** The view changed or the world moved: follow it. */
    render(v) {
      if (v !== M.view) M.view = v;
      paint();
    },
  };
}
