// @ts-check
import { redraw } from "../../core/ui/redraw.js";
import { NW, NH, PAD, layoutOf, edgePath } from "./layout.js";

/** @import { CameraLead, CameraScope, Point } from "./camera-types.d.ts" */

/** @import { DrawAgent, GraphEdge } from "./drawing-types.d.ts" */

/** @import { Box } from "./layout.js" */

/** @import { TreeNode } from "./tree-types.d.ts" */

/** @typedef {ReturnType<typeof layoutOf>["nodes"][number]} LayoutBox */

/** @param {import("./diagram-types.d.ts").DiagramDeps} options */
export function createMapDiagram({ M, host, view, tagW, camOf, holdStill, focusNode, cursors, boxHtml }) {
  /** @param {CameraScope} scope @param {Box} tree @param {DrawAgent[]} ags @param {Map<string, string>} at @param {Map<string, string>} lit */
  return function paintDiagram(scope, tree, ags, at, lit) {
    const el = host();
    const L = layoutOf(tree), old = M.layout;
    M.layout = L;
    const byId = new Map(L.nodes.map((n) => [n.id, n]));
    const parentOfId = new Map(L.edges.map((e) => [e.to.id, e.from]));
    /** @param {LayoutBox} n @returns {CameraLead["side"]} */
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
    const nodesHtml = L.nodes.map((n) => boxHtml(/** @type {TreeNode & Point} */ (n), at)).join("");
    const key = `${L.w}x${L.h}|${nodesHtml}|${[...lit].join()}`;
    if (key !== M.layoutKey) {
      const a = /** @type {HTMLElement | null} */ (document.activeElement), fid = a && el.contains(a) ? a.dataset.node : null;
      const W = L.w + PAD * 2, H = L.h + PAD * 2;
      const svg = /** @type {GraphEdge} */ (el.querySelector(".dg-edges"));
      svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.innerHTML = `<g transform="translate(${PAD} ${PAD})">${L.edges.map((e) => { const c = lit.get(e.to.id); return `<path d="${edgePath(/** @type {Point} */ (e.from), /** @type {Point} */ (e.to))}"${c ? ` class="is-lit" style="stroke:${c}"` : ""}/>`; }).join("")}</g>`;
      const nodes = /** @type {HTMLElement} */ (el.querySelector(".dg-nodes"));
      nodes.style.width = W + "px"; nodes.style.height = H + "px";
      redraw(nodes, nodesHtml);
      M.layoutKey = key;
      if (old) holdStill(scope, old, L);
      if (fid != null) focusNode(nodes, fid);
    }
    const cam = camOf(scope), vw = view()?.clientWidth || 0, tw = tagW();
    cursors(ags, (id) => {
      const n = byId.get(id);
      if (!n) return null;
      let side = sideOf(n);
      // a name that would run off the canvas's right edge goes on the box's left instead
      if (side === "right" && vw && cam.x + (n.x + PAD + NW + 2 + tw) * cam.s > vw - 8) side = "left";
      return { x: side === "left" ? n.x + PAD + 10 : n.x + PAD + NW + 2, y: n.y + PAD + 9, cx: n.x + PAD + NW / 2, cy: n.y + PAD + NH / 2, side };
    });
  };
}
