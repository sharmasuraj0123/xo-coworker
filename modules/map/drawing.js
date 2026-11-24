// @ts-check
import { esc } from "../../core/platform/util.js";
import { redraw } from "../../core/ui/redraw.js";
import { fileColor } from "../../core/ui/icons/fileicons.js";
import { gstep, RAD } from "./graph-physics.js";
import { ARROW } from "./icons.js";
import { parentOf } from "./tree.js";
/** @import { CameraScope } from "./camera-types.d.ts" */

/** @import { Position } from "./graph-physics.js" */

/** @import { CursorPoint, DrawAgent, DrawingDeps, GraphEdge, GraphItem } from "./drawing-types.d.ts" */

/** @param {DrawingDeps} options */
export function createMapDrawing({ M, host, verbOf, tagW, focusNode, camOf, frame, clamp }) {
  /** @param {DrawAgent} a @param {Set<string>} ids @param {string} rootId */
  function spotOf(a, ids, rootId) {
    if ((/** @type {CameraScope} */ (M.scope)).kind === "all") return ids.has(/** @type {string} */ (a.node)) ? a.node : null;
    /** @param {string | null} p */
    const within = (p) => { let q = p; while (q) { if (ids.has(q)) return { id: q, exact: q === p }; q = parentOf(q); } return null; };
    const tries = [a.path, ...[...(a.spots || [])].reverse(), a.busy ? a.prev : null].filter(Boolean);
    let near = null;
    for (const p of tries) { const r = within(p); if (r && r.exact) return r.id; if (r && !near) near = r; }
    return near ? near.id : rootId;
  }
  /** @param {DrawAgent[]} ags @param {(id: string) => CursorPoint | null} place */
  function cursors(ags, place) {
    const el = host();
    const box = el.querySelector(".dg-curs");
    if (!box) return;
    const seen = new Set(), stack = new Map(), share = new Map();
    for (const a of ags) if (a.nid != null) share.set(a.nid, (share.get(a.nid) || 0) + 1);
    M.lead = null;
    for (const a of ags) {
      const p = a.nid != null ? place(a.nid) : null;
      if (!p) continue;
      const i = stack.get(a.nid) || 0; stack.set(a.nid, i + 1);
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
      if (c.tag !== tag) { redraw(/** @type {HTMLButtonElement} */ (c.el.querySelector(".dg-tag")), tag); c.tag = tag; }
      if (c.node !== a.nid) {
        // it landed somewhere new: the box answers once, in its colour
        if (c.node != null) { const b = /** @type {HTMLElement | null} */ (el.querySelector(`[data-node="${CSS.escape(/** @type {string} */ (a.nid))}"]`)); if (b) { b.style.setProperty("--c", a.color); b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit"); } }
        c.node = a.nid;
      }
      if (!M.lead && a.busy) M.leadNode = a.nid;
      if (!M.lead && a.busy) M.lead = { key: `${a.id}@${a.nid}`, pt: { x: p.cx - (p.side === "left" ? tagW() : p.side === "below" ? tagW() / 2 : 0), y: p.cy }, at: { x, y }, side: p.side || "right", tw: (/** @type {HTMLButtonElement | null} */ (c.el.querySelector(".dg-tag")))?.offsetWidth || 0 };
    }
    for (const [k, c] of M.curs) if (!seen.has(k)) { c.el.classList.add("is-gone"); setTimeout(() => c.el.remove(), 320); M.curs.delete(k); }
  }

  /** @param {GraphItem} n @param {Map<string, string>} at */
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
  /** @param {CameraScope} scope @param {GraphItem[]} flat @param {DrawAgent[]} ags @param {Map<string, string>} at */
  function paintGraph(scope, flat, ags, at) {
    if (!M.gpos.has(scope.key)) M.gpos.set(scope.key, new Map());
    const pos = /** @type {Map<string, Position>} */ (M.gpos.get(scope.key));
    const el = host();
    const nodes = /** @type {HTMLElement} */ (el.querySelector(".dg-nodes")), svg = /** @type {SVGSVGElement} */ (el.querySelector(".dg-edges"));
    const html = flat.map((n) => gnodeHtml(n, at)).join("");
    if (html !== M.layoutKey) {
      const shape = flat.map((n) => `${n.id}<${n.parent}`).join("|");
      const a = /** @type {HTMLElement | null} */ (document.activeElement), fid = a && el.contains(a) ? a.dataset.node : null;
      // new boxes start beside their parent, and the graph wakes up to make room
      for (const n of flat) if (!pos.has(n.id)) {
        const par = n.parent != null ? pos.get(n.parent) : null, ang = Math.random() * Math.PI * 2;
        pos.set(n.id, { x: (par ? par.x : 0) + Math.cos(ang) * 24, y: (par ? par.y : 0) + Math.sin(ang) * 24, vx: 0, vy: 0 });
      }
      nodes.style.width = nodes.style.height = "0px";
      redraw(nodes, html);
      svg.setAttribute("width", "1"); svg.setAttribute("height", "1"); svg.removeAttribute("viewBox");
      const byEl = new Map([.../** @type {HTMLCollectionOf<HTMLElement>} */ (nodes.children)].map((e) => [e.dataset.node, e]));
      M.gnodes = flat.map((n) => ({ n, p: /** @type {Position} */ (pos.get(n.id)), par: n.parent != null ? /** @type {Position} */ (pos.get(n.parent)) : null, el: byEl.get(n.id) }));
      svg.innerHTML = M.gnodes.filter((g) => g.par).map(() => "<line/>").join("");
      M.gedges = [.../** @type {HTMLCollectionOf<GraphEdge>} */ (svg.children)];
      M.layoutKey = html;
      if (shape !== M.gkey) { M.alpha = Math.max(M.alpha, M.gkey ? 0.25 : 0.9); M.gkey = shape; }
      if (fid != null) focusNode(nodes, fid);
    }
    M.gags = ags;
    gdraw();
    if (M.alpha > 0.02) gkick();
  }
  function gdraw() {
    for (const g of M.gnodes) if (g.el && !g.ext && g.el.offsetWidth) {
      const css = getComputedStyle(g.el), l = parseFloat(css.marginLeft) || 0, t = parseFloat(css.marginTop) || 0;
      g.ext = { l, t, r: l + g.el.offsetWidth, b: t + g.el.offsetHeight };
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of M.gnodes) {
      const { x, y } = g.p;
      if (g.el) g.el.style.transform = `translate(${x}px,${y}px)`;
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
    const tag = M.gags && M.gags.length ? tagW() * 0.6 : 0;
    if (M.gnodes.length) { M.bounds = { x0: x0 - 12, y0: y0 - 12, x1: x1 + 12 + tag, y1: y1 + 12 }; M.rootPt = { x: 0, y: 0 }; }
    const at = new Map(M.gnodes.map((g) => [g.n.id, g]));
    cursors(M.gags, (id) => { const g = at.get(id); if (!g) return null; const r = RAD[g.n.kind] || 4; return { x: g.p.x + r * 0.55, y: g.p.y + r * 0.55, cx: g.p.x, cy: g.p.y, deck: true }; });
  }
  function gkick() {
    if (M.raf) return;
    const loop = () => {
      M.raf = 0;
      if (!M.open || M.mode !== "graph" || !M.gnodes.length) return;
      gstep(M, clamp); gstep(M, clamp);
      M.alpha *= 0.975;
      gdraw();
      const c = M.scope && camOf(M.scope);
      if (c) frame(c);
      if (M.alpha > 0.02) M.raf = requestAnimationFrame(loop);
    };
    M.raf = requestAnimationFrame(loop);
  }
  return { spotOf, cursors, paintGraph };
}
