// @ts-check

import { elapsed } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { READABLE } from "./camera.js";
import { layoutOf, PAD } from "./layout.js";

/** @import {MapDrawAgent, MapNode, MapRenderDeps, Scope} from "./map-types.d.ts" */

/** @param {MapRenderDeps} options */
export function createMapRender({
  M, host, view, scopeOf, skeleton, reframe, agentOf, agentsIn, projectsTree, folderTree,
  tagW, headHtml, spotOf, paintGraph, paintDiagram, frame, camOf,
}) {
  return function paint() {
    const el = host();
    if (!M.open || !el || M.waking) return;
    const scope = scopeOf(M.view);
    const sk = scope.key + "|" + M.mode;
    if (M.lastScope !== sk) { M.lastScope = sk; reframe(scope); }
    M.scope = scope;
    if (el.dataset.scope !== scope.key + "|" + M.mode || !view()) skeleton(scope);
    /** @type {MapDrawAgent[]} */
    let ags;
    /** @type {Omit<MapNode, "parent">} */
    let tree;
    /** @type {MapDrawAgent["act"]["files"]} */
    let marks = new Map();
    M.refs = new Map();
    if (scope.kind === "thread") {
      ags = [agentOf(scope.t)];
      marks = ags[0].act.files;
    } else ags = agentsIn(scope.kind === "project" ? scope.pid : null);
    if (scope.kind === "all") tree = projectsTree(ags);
    else if (scope.fold) {
      const hotPaths = ags
        .filter((agent) => scope.kind === "thread" || agent.fold)
        .flatMap((agent) => [agent.path, ...(agent.spots || []), agent.busy ? agent.prev : null]);
      const hot = new Set(hotPaths.filter((path) => typeof path === "string").filter(Boolean));
      tree = folderTree(scope, scope.fold, marks, hot, true);
      const v = view();
      if (M.mode === "tree" && M.fit?.key !== sk && v && v.clientWidth) {
        const L = layoutOf(tree);
        const tooWide = (L.w + PAD * 2 + tagW()) * READABLE > v.clientWidth - 24;
        const tooTall = (L.h + PAD * 2) * READABLE > v.clientHeight - 44 - 24;
        M.fit = { key: sk, fold: tooWide || tooTall };
      }
      if (M.mode === "tree" && M.fit?.key === sk && M.fit.fold) {
        M.refs = new Map();
        tree = folderTree(scope, scope.fold, marks, hot, false);
      }
    } else {
      const thread = /** @type {Extract<Scope, {kind: "thread"}>} */ (scope).t;
      tree = { id: "", kind: "root", name: thread.title, sub: "its folder isn't one XO can show", children: [] };
    }
    const h = headHtml(scope, ags);
    if (h !== M.head) {
      const hd = /** @type {HTMLElement} */ (el.querySelector("[data-mp-head]"));
      const active = document.activeElement;
      const fid = active instanceof HTMLElement && hd.contains(active) ? active.dataset.mpFocus || active.dataset.mpGo : null;
      redraw(hd, h);
      M.head = h;
      for (const timestamp of /** @type {NodeListOf<HTMLElement>} */ (hd.querySelectorAll(".elapsed[data-since]"))) {
        const seconds = (Date.now() - Number(timestamp.dataset.since)) / 1000;
        timestamp.textContent = elapsed(Math.max(0, Math.floor(seconds)));
      }
      if (fid) /** @type {HTMLElement | null} */ (hd.querySelector(`[data-mp-focus="${CSS.escape(fid)}"]`))?.focus({ preventScroll: true });
    }
    /** @type {MapNode[]} */
    const flat = [];
    /** @param {Omit<MapNode, "parent">} n @param {string | null} parent */
    const walk = (n, parent) => { flat.push({ ...n, parent }); for (const c of n.children || []) walk(c, n.id); };
    walk(tree, null);
    const ids = new Set(flat.map((n) => n.id)), parentById = new Map(flat.map((n) => [n.id, n.parent]));
    for (const a of ags) a.nid = spotOf(a, ids, tree.id);
    const at = new Map(), lit = new Map();
    for (const a of ags) {
      if (!a.busy || a.nid == null) continue;
      if (!at.has(a.nid)) at.set(a.nid, a.color);
      let /** @type {string | null | undefined} */ id = a.nid;
      while (id != null && parentById.get(id) != null) {
        if (!lit.has(id)) lit.set(id, a.color);
        id = parentById.get(id);
      }
    }
    M.glit = lit;
    M.loading = flat.some((n) => n.kind === "note" && !n.btn && n.name === "Reading…");
    if (M.mode === "graph") paintGraph(scope, /** @type {import("./drawing-types.d.ts").GraphItem[]} */ (flat), ags, at);
    else paintDiagram(scope, tree, ags, at, lit);
    const kd = /** @type {HTMLElement | null} */ (el.querySelector("[data-dg-key]"));
    const kinds = new Set([...marks.values()].map((m) => m.mark).filter((m) => m !== "read"));
    const legend = /** @type {const} */ (["new", "edited", "deleted"]);
    const kh = legend.filter((kind) => kinds.has(kind)).map((kind) => `<span class="m-${kind}"><i></i>${kind}</span>`).join("");
    if (kd) { redraw(kd, kh); kd.hidden = !kh; }
    frame(camOf(scope));
  };
}
