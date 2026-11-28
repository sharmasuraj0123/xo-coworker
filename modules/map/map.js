// @ts-check
import { api } from "../../core/platform/api.js";
import { read } from "../../core/platform/storage.js";
import { createScope } from "../../core/kernel/scope.js";
import { folderOf } from "../../core/services/places.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { MAP_ICON, TOOL } from "./icons.js";
import { afterPause } from "./after-pause.js";
import { createMapFolders } from "./folders.js";
import { createMapTree } from "./tree.js";
import { createMapCamera } from "./camera.js";
import { createMapDrawing } from "./drawing.js";
import { createMapDiagram } from "./diagram.js";
import { createMapHead } from "./head.js";
import { createMapInput } from "./input.js";
import { createMapRender } from "./render.js";
/** @import { MapController, MapDeps, MapState, Scope } from "./map-types.d.ts" */
export { MAP_ICON };
const MODE_KEY = "cv-map-mode";
/** @param {number} v @param {number} a @param {number} b */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** @param {MapState["mode"]} mode @param {boolean} follow */
function viewportHtml(mode, follow) {
  return '<div class="mp-head" data-mp-head></div>' +
    '<div class="dg" data-dg tabindex="0" role="group" aria-label="The diagram: drag to move around, ⌘ or Ctrl and scroll to zoom">' +
    `<div class="dg-world k-${mode}"><svg class="dg-edges" aria-hidden="true"></svg>` +
    '<div class="dg-nodes"></div><div class="dg-curs"></div></div>' +
    '<div class="dg-tools" role="toolbar" aria-label="View">' +
    '<span class="dg-mode" role="group" aria-label="Draw it as">' +
    `<button type="button" data-dg="tree" aria-pressed="${mode === "tree"}" title="Diagram (G)" aria-label="Diagram">` +
    `${TOOL.tree}</button>` +
    `<button type="button" data-dg="graph" aria-pressed="${mode === "graph"}" title="Graph (G)" aria-label="Graph">` +
    `${TOOL.graph}</button>` +
    '</span><i class="dg-sep" aria-hidden="true"></i>' +
    `<button type="button" data-dg="out" title="Zoom out (−)" aria-label="Zoom out">${TOOL.out}</button>` +
    `<button type="button" data-dg="in" title="Zoom in (+)" aria-label="Zoom in">${TOOL.in}</button>` +
    `<button type="button" data-dg="fit" title="Fit it all (0)" aria-label="Fit it all">${TOOL.fit}</button>` +
    (follow ? '<button type="button" data-dg="follow" title="Follow the agent (F)" aria-label="Follow the agent" aria-pressed="false">' +
      `${TOOL.follow}</button>` : '') +
    '</div><div class="dg-key" data-dg-key></div></div>';
}

/** @param {MapDeps} options @returns {MapController} */
export function createMap({ world, go, announce, isBusy, openFile, activity }) {
  let el = /** @type {HTMLElement | null} */ (null);
  let mountScope = createScope();
  let folders = createMapFolders(api, () => paint(), mountScope);
  let cancelWake = () => {};
  /** @type {(() => void) | null} */
  let disposeViewport = null;
  /** @type {MapState} */
  const M = {
    open: false, view: "home",
    opened: new Map(),
    closed: new Map(), more: new Map(), shown: new Map(),
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
  if (read(MODE_KEY, String, "") === "tree") M.mode = "tree";
  const tagW = () => 22;
  /** @param {string} v @returns {Scope} */
  function scopeOf(v) {
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) return { kind: "thread", t, key: v, fold: folderOf(t) }; }
    if (v.startsWith("p:")) return { kind: "project", pid: v.slice(2), key: v, fold: { project: v.slice(2), base: "" } };
    return { kind: "all", key: "all" };
  }
  const { agentOf, agentsIn, doingLine, verbOf } = activity;
  const headHtml = createMapHead(world, doingLine, verbOf);
  const load = (/** @type {Parameters<typeof folders.load>} */ ...args) => {
    void folders.load(...args).catch(reportFailure);
  };
  const folderAt = (/** @type {Parameters<typeof folders.get>} */ ...args) => folders.get(...args);
  const { folderTree, projectsTree, boxHtml } = createMapTree(
    /** @type {Parameters<typeof createMapTree>[0]} */ ({ M, world, load, folderAt }),
  );
  /** @param {Scope} scope */
  function skeleton(scope) {
    disposeViewport?.();
    disposeViewport = null;
    /** @type {HTMLElement} */ (el).innerHTML = viewportHtml(M.mode, scope.kind !== "all");
    M.head = ""; M.layoutKey = ""; M.reachKey = ""; M.curs = new Map(); M.gkey = ""; M.gnodes = []; M.gedges = [];
    /** @type {HTMLElement} */ (el).dataset.scope = scope.key + "|" + M.mode;
    const viewport = view();
    if (!viewport || mountScope.signal.aborted) return;
    const lifetime = createScope();
    disposeViewport = mountScope.effect(() => lifetime.dispose);
    wire(viewport, scope, lifetime);
  }
  const view = () => /** @type {HTMLElement | null} */ (el?.querySelector("[data-dg]") ?? null);
  /** @param {HTMLElement} nodes @param {string} fid */
  function focusNode(nodes, fid) {
    let id = fid, to = null;
    while (!to && id) {
      to = /** @type {HTMLElement | null} */ (nodes.querySelector(`[data-node="${CSS.escape(id)}"]`));
      id = id.includes("/") ? id.replace(/\/[^/]*$/, "") : "";
    }
    (to || view())?.focus({ preventScroll: true });
  }
  const world$ = () => /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (el).querySelector(".dg-world"));
  const camera = createMapCamera({ M, host: () => /** @type {HTMLElement} */ (el), view, world$, tagW, clamp });
  const { camOf, fit, frame, holdStill, reframe } = camera;
  const mapHost = () => /** @type {HTMLElement} */ (el);
  const { spotOf, cursors, paintGraph } = createMapDrawing({ M, host: mapHost, verbOf, tagW, focusNode, camOf, frame, clamp });
  const paintDiagram = createMapDiagram({ M, host: mapHost, view, tagW, camOf, holdStill, focusNode, cursors, boxHtml });
  const paint = createMapRender({
    M, host: () => el, view, scopeOf, skeleton, reframe, agentOf, agentsIn, projectsTree, folderTree,
    tagW, headHtml, spotOf, paintGraph, paintDiagram, frame, camOf,
  });
  const { wire, bind, tool } = createMapInput({
    M, host: mapHost, view, camera, clamp,
    paint, load, tagW, modeKey: MODE_KEY, announce, go, openFile,
  });
  /** @param {string} v */
  function liveIn(v) {
    const s = scopeOf(v);
    if (s.kind === "thread") return isBusy(s.t);
    if (s.kind === "project") return world.state.threads.some((t) => t.project === s.pid && isBusy(t));
    return world.state.threads.some(isBusy);
  }
  /** @param {HTMLElement} node */
  function observeResize(node) {
    if (typeof ResizeObserver === "function") {
      let w0 = 0, h0 = 0;
      const observer = new ResizeObserver(() => {
        const v = view();
        if (!M.open || !v || !M.scope) return;
        const w = v.clientWidth, h = v.clientHeight;
        if (w === w0 && h === h0) return;
        const was = w0; w0 = w; h0 = h;
        const c = camOf(M.scope);
        if (was && c.fitAll) { fit(c, false, true); return; } // you asked to see it all: keep it all in view
        if (was && !c.user) { c.done = false; c.settleUntil = 0; c.target = null; } // the frame changed size: a fresh fit
        frame(c);
      });
      observer.observe(node); mountScope.observe(observer);
    }
  }
  return {
    mount(host, scope) {
      if (!host) return;
      if (el !== host) {
        this.unmount();
        mountScope = scope ?? createScope(); folders = createMapFolders(api, paint, mountScope);
        el = host;
        bind(host, mountScope);
        observeResize(host);
        host.classList.add("map-host");
        /** @type {HTMLElement} */ (el).dataset.scope = ""; M.head = "";
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
      M.head = ""; M.waking = true;
      cancelWake = mountScope.effect(() => afterPause(() => {
        cancelWake();
        M.waking = false;
        paint();
        const c = M.scope && camOf(/** @type {Scope} */ (M.scope));
        if (c) mountScope.frame(() => { if (M.open && !M.waking) { paint(); frame(c); } });
      }));
    },
    hide() { cancelWake(); M.open = M.waking = false; if (M.raf) { cancelAnimationFrame(M.raf); M.raf = 0; } },
    unmount() {
      this.hide();
      mountScope.dispose();
      disposeViewport = null;
      el = null;
    },
    live: liveIn,
    get mode() { return M.mode; },
    setMode: (m) => tool(m, { focus: false }),
    render(v) {
      if (v !== M.view) M.view = v;
      paint();
    },
  };
}
