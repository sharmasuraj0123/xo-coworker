import { api } from "../../core/platform/api.js";
import { elapsed } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { folderOf } from "../../core/services/places.js";
import { PAD, layoutOf } from "./layout.js";
import { MAP_ICON, TOOL } from "./icons.js";
import { afterPause } from "./after-pause.js";
import { createMapFolders } from "./folders.js";
import { createMapAgents } from "./agents.js";
import { createMapTree, setOf } from "./tree.js";
import { createMapCamera, READABLE } from "./camera.js";
import { createMapDrawing } from "./drawing.js";
import { createMapDiagram } from "./diagram.js";
import { createMapHead } from "./head.js";

export { MAP_ICON };
const MODE_KEY = "cv-map-mode";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createMap({ world, go, announce, isBusy, openFile, stepLineHtml }) {
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
    mode: "graph",
    bounds: null,        // the drawing's extent by its layout (bounds() adds the boxes as drawn), for Fit
    reach: null, reachKey: "", // the drawn boxes' far edges, and the drawing they were measured on
    gpos: new Map(),     // scope key → Map box id → {x, y, vx, vy}: the graph keeps its shape across redraws
    gkey: "", gnodes: [], gedges: [], alpha: 0, raf: 0, gags: [], glit: new Map(),
  };
  try { if (localStorage.getItem(MODE_KEY) === "tree") M.mode = "tree"; } catch { /* private mode */ }
  // a box's words change width when the font arrives: measure the drawing again
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => { M.reachKey = ""; });
  const tagW = () => 22;

  function scopeOf(v) {
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) return { kind: "thread", t, key: v, fold: folderOf(t) }; }
    if (v.startsWith("p:")) return { kind: "project", pid: v.slice(2), key: v, fold: { project: v.slice(2), base: "" } };
    return { kind: "all", key: "all" };
  }
  const { agentOf, agentsIn, doingLine, verbOf } = createMapAgents({ world, isBusy, stepLineHtml });
  const headHtml = createMapHead(world, doingLine, verbOf);

  const { load, get: folderAt } = createMapFolders(api, paint);
  const { folderTree, projectsTree, boxHtml } = createMapTree({ M, world, load, folderAt });

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
  function focusNode(nodes, fid) {
    let id = fid, to = null;
    while (!to && id) { to = nodes.querySelector(`[data-node="${CSS.escape(id)}"]`); id = id.includes("/") ? id.replace(/\/[^/]*$/, "") : ""; }
    (to || view())?.focus({ preventScroll: true });
  }
  const world$ = () => el.querySelector(".dg-world");

  const { applyCam, camOf, centerOn, fit, frame, holdStill, keepInView, reframe, zoomAt } =
    createMapCamera({ M, host: () => el, view, world$, tagW, clamp });
  const { spotOf, cursors, paintGraph } = createMapDrawing({ M, host: () => el, verbOf, tagW, focusNode, camOf, frame, clamp });
  const paintDiagram = createMapDiagram({ M, host: () => el, view, tagW, camOf, holdStill, focusNode, cursors, boxHtml });
  const PRESS_PX = 24;
  const PHONE = typeof matchMedia === "function" ? matchMedia("(max-width:760px)") : null;
  const onPhone = () => !!(PHONE && PHONE.matches);
  const pressMin = () => (onPhone() ? 36 : PRESS_PX);
  const tooSmall = (b, s, anyScale = false) => (onPhone() ? pressPx(b, s) < 36 : (anyScale || s < READABLE) && pressPx(b, s) < PRESS_PX);
  const pressScale = (b, s, anyScale = false) => Math.min(2.4, Math.max(READABLE, ...(onPhone() || anyScale ? [s, pressMin() / Math.max(1, Math.min(b.offsetWidth, b.offsetHeight))] : [])));
  function pressPx(nb, s) {
    const b = getComputedStyle(nb, "::before"), hit = b.content !== "none" && b.position === "absolute";
    const grow = (v) => (hit ? Math.max(0, -parseFloat(v) || 0) : 0);
    return Math.min(nb.offsetWidth + 2 * grow(b.left), nb.offsetHeight + 2 * grow(b.top)) * s;
  }
  function nodePt(nb) {
    let tx = 0, ty = 0;
    try { if (nb.style.transform) { const m = new DOMMatrixReadOnly(nb.style.transform); tx = m.e; ty = m.f; } } catch { /* no move */ }
    return { x: tx + nb.offsetLeft + nb.offsetWidth / 2, y: ty + nb.offsetTop + nb.offsetHeight / 2 };
  }

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
  function wire(v) {
    const pts = new Map();
    let start = null;
    v.addEventListener("focusin", (e) => { if (e.target !== v && e.target.closest(".dg-world")) reveal(e.target); });
    v.addEventListener("focusout", (e) => {
      const to = e.relatedTarget;
      if (!e.target.closest(".dg-world") || (to && to.closest && to.closest(".dg-world"))) return;
      // unfold in place: the box you clicked stays under your pointer, at the same size
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
      { const c0 = camOf(M.scope); if (!c0.user || c0.fitAll) { c0.done = false; c0.settleUntil = 0; c0.target = null; c0.fitB = null; } }
      try { localStorage.setItem(MODE_KEY, what); } catch { /* private mode */ }
      el.dataset.scope = "";
      paint();
      if (focus) view()?.focus({ preventScroll: true });
      announce(what === "graph" ? "Graph view." : "Diagram view.");
    }
    else if (what === "follow") {
      c.follow = !c.follow;
      if (c.follow) c.fitAll = false;
      if (c.follow && M.lead) { c.target = M.lead.key; centerOn(c, M.lead.pt, true); }
      el.querySelector('[data-dg="follow"]')?.setAttribute("aria-pressed", String(!!c.follow));
      announce(c.follow ? "Following the agent." : "Not following.");
    }
  }

  function paint() {
    if (!M.open || !el || M.waking) return;
    const scope = scopeOf(M.view);
    const sk = scope.key + "|" + M.mode;
    if (M.lastScope !== sk) { M.lastScope = sk; reframe(scope); }
    M.scope = scope;
    if (el.dataset.scope !== scope.key + "|" + M.mode || !view()) skeleton(scope);
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
      const v = view();
      if (M.mode === "tree" && M.fit?.key !== sk && v && v.clientWidth) {
        const L = layoutOf(tree);
        M.fit = { key: sk, fold: (L.w + PAD * 2 + tagW()) * READABLE > v.clientWidth - 24 || (L.h + PAD * 2) * READABLE > v.clientHeight - 44 - 24 };
      }
      if (M.mode === "tree" && M.fit?.key === sk && M.fit.fold) { M.refs = new Map(); tree = folderTree(scope, scope.fold, marks, hot, false); }
    }
    else tree = { id: "", kind: "root", name: scope.t.title, sub: "its folder isn't one XO can show", children: [] };
    const h = headHtml(scope, ags);
    if (h !== M.head) {
      const hd = el.querySelector("[data-mp-head]");
      const a = document.activeElement, fid = a && hd.contains(a) ? a.dataset.mpFocus || a.dataset.mpGo : null;
      redraw(hd, h); M.head = h; // in place: the legend's buttons stay the same nodes as the agents' verbs change
      for (const x of hd.querySelectorAll(".elapsed[data-since]")) x.textContent = elapsed(Math.max(0, Math.floor((Date.now() - +x.dataset.since) / 1000)));
      if (fid) hd.querySelector(`[data-mp-focus="${CSS.escape(fid)}"]`)?.focus({ preventScroll: true });
    }
    const flat = [];
    const walk = (n, parent) => { flat.push({ ...n, parent }); for (const c of n.children || []) walk(c, n.id); };
    walk(tree, null);
    const ids = new Set(flat.map((n) => n.id)), parentById = new Map(flat.map((n) => [n.id, n.parent]));
    for (const a of ags) a.nid = spotOf(a, ids, tree.id);
    const at = new Map(), lit = new Map();
    for (const a of ags) {
      if (!a.busy || a.nid == null) continue;
      if (!at.has(a.nid)) at.set(a.nid, a.color);
      for (let id = a.nid; id != null && parentById.get(id) != null; id = parentById.get(id)) if (!lit.has(id)) lit.set(id, a.color);
    }
    M.glit = lit;
    M.loading = flat.some((n) => n.kind === "note" && !n.btn && n.name === "Reading…");
    if (M.mode === "graph") paintGraph(scope, flat, ags, at);
    else paintDiagram(scope, tree, ags, at, lit);
    const kd = el.querySelector("[data-dg-key]");
    const kinds = new Set([...marks.values()].map((m) => m.mark).filter((m) => m !== "read"));
    const kh = kinds.size ? ["new", "edited", "deleted"].filter((k) => kinds.has(k)).map((k) => `<span class="m-${k}"><i></i>${k}</span>`).join("") : "";
    if (kd && kd._h !== kh) { kd.innerHTML = kh; kd._h = kh; kd.hidden = !kh; }
    frame(camOf(scope));
  }

  function liveIn(v) {
    const s = scopeOf(v);
    if (s.kind === "thread") return isBusy(s.t);
    if (s.kind === "project") return world.state.threads.some((t) => t.project === s.pid && isBusy(t));
    return world.state.threads.some(isBusy);
  }

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
        cz.user = true; cz.follow = false; cz.fitAll = false;
        const pt = nodePt(nb);
        centerOn(cz, { x: pt.x - tagW() / 2, y: pt.y }, true, pressScale(nb, cz.s));
        announce(`Closer to ${nb.textContent.trim() || "it"}: press it again to open it.`);
        return;
      }
      const key = M.scope.key;
      if (r.toggle != null || r.more != null) {
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
    show(v) {
      if (!el) return;
      const was = M.open;
      if (v) M.view = v;
      M.open = true;
      if (!view() || el.dataset.scope !== scopeOf(M.view).key + "|" + M.mode) { el.dataset.scope = ""; M.lastScope = null; }
      if (was) { paint(); return; }
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
    hide() { M.open = false; M.waking = false; M.wakeGen = (M.wakeGen || 0) + 1; if (M.raf) { cancelAnimationFrame(M.raf); M.raf = 0; } },
    unmount() { this.hide(); },
    live: (v) => liveIn(v),
    agents(v) {
      const s = scopeOf(v || M.view);
      const list = s.kind === "thread" ? [agentOf(s.t)] : agentsIn(s.kind === "project" ? s.pid : null);
      return list.map((a) => ({ id: a.id, title: a.title, go: a.go, busy: a.busy, waiting: a.waiting, color: a.color, since: a.since,
        doing: a.waiting ? "waiting for you" : `${verbOf(a)}${a.liveFile ? ` ${a.liveFile.path.split("/").pop()}` : ""}` }));
    },
    get mode() { return M.mode; },
    setMode: (m) => tool(m, { focus: false }),
    render(v) {
      if (v !== M.view) M.view = v;
      paint();
    },
  };
}
