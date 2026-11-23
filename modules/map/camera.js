// @ts-check
import { PAD } from "./layout.js";

/** @import { Bounds, Camera, CameraDeps, CameraLayout, CameraLead, CameraScope, Point } from "./camera-types.d.ts" */

export const READABLE = 0.8; // smallest scale for a readable partial view

/** @param {CameraDeps} options */
export function createMapCamera({ M, host, view, world$, tagW, clamp }) {
  /** @param {CameraScope} scope */
  function camOf(scope) {
    const k = scope.key + "|" + M.mode;
    if (!M.cams.has(k)) M.cams.set(k, { x: 24, y: 24, s: 1, user: false, follow: scope.kind === "thread" && M.mode === "tree", target: null });
    return /** @type {Camera} */ (M.cams.get(k));
  }
  /** @param {Camera} c @param {boolean} glide */
  function applyCam(c, glide) {
    const w = world$();
    if (!w) return;
    w.classList.toggle("is-glide", !!glide);
    w.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.s})`;
    w.style.setProperty("--dg-s", String(c.s));
    w.classList.toggle("is-near", c.s >= 1.15); // close enough to read every name
    const f = host().querySelector('[data-dg="follow"]');
    if (f) f.setAttribute("aria-pressed", String(!!c.follow));
  }
  function bounds() {
    const B = M.bounds;
    if (!B || M.mode !== "tree") return B;
    if (M.reachKey !== M.layoutKey) {
      const v = view();
      if (!v || !v.clientWidth) return B;
      let rx = 0, ry = 0;
      for (const b of /** @type {NodeListOf<HTMLElement>} */ (host().querySelectorAll(".dg-nodes > .dg-n"))) { rx = Math.max(rx, b.offsetLeft + b.offsetWidth); ry = Math.max(ry, b.offsetTop + b.offsetHeight); }
      M.reach = { x: rx + PAD, y: ry + PAD }; M.reachKey = M.layoutKey;
    }
    const R = /** @type {Point} */ (M.reach);
    return R.x > B.x1 || R.y > B.y1 ? { ...B, x1: Math.max(B.x1, R.x), y1: Math.max(B.y1, R.y) } : B;
  }
  /** @param {Camera} c @param {boolean} glide */
  function fit(c, glide, all = false) {
    const v = view(), B = bounds();
    if (!v || !B || !v.clientWidth) return;
    const W = B.x1 - B.x0, H = B.y1 - B.y0, vh = v.clientHeight - 44, cw = v.clientWidth - 24, ch = vh - 24;
    const s = Math.min(cw / W, ch / H);
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
  /** @param {Camera} c @param {Point} pt @param {boolean} glide @param {number} [s] */
  function centerOn(c, pt, glide, s) {
    const v = view();
    if (!v || !v.clientWidth) return;
    if (s) c.s = s;
    c.x = v.clientWidth / 2 - (pt.x + tagW() / 2) * c.s; // the cursor and its name, not just the box
    c.y = (v.clientHeight - 44) / 2 - pt.y * c.s;
    applyCam(c, glide);
  }
  /** @param {Camera} c @param {number} f @param {number} px @param {number} py */
  function zoomAt(c, f, px, py) {
    const s = clamp(c.s * f, 0.25, 2.4);
    c.x = px - (px - c.x) * (s / c.s); c.y = py - (py - c.y) * (s / c.s); c.s = s;
    c.user = true; c.fitAll = false;
    applyCam(c, false);
  }

  const SETTLE_MS = 1600;
  /** @param {Camera} c */
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
    const B = /** @type {Bounds} */ (bounds()), F = c.fitB;
    const moved = !F || Math.max(Math.abs(B.x0 - F.x0), Math.abs(B.y0 - F.y0), Math.abs(B.x1 - F.x1), Math.abs(B.y1 - F.y1)) > 8;
    const over = B.x0 * c.s + c.x < 0 || B.x1 * c.s + c.x > v.clientWidth || B.y0 * c.s + c.y < 0 || B.y1 * c.s + c.y > v.clientHeight - 44;
    const refit = !c.user ? moved || over : c.fitAll && (over || (moved && M.mode !== "graph"));
    if (refit) { fit(c, true, true); return; }
    if (c.follow && lead && c.target !== lead.key) { c.target = lead.key; keepInView(c, lead); }
  }
  /** @param {CameraScope} scope */
  function reframe(scope) {
    const c = camOf(scope);
    if (!c.user) { c.done = false; c.settleUntil = 0; c.target = null; }
  }
  /** @param {Camera} c @param {CameraLead} lead */
  function keepInView(c, lead) {
    const v = view();
    if (!v || !v.clientWidth || !lead.at) return;
    const W = v.clientWidth, H = v.clientHeight - 44, m = 48;
    const a = lead.at, tw = lead.tw || 0;
    // the arrow's box (an 18 px glyph at its tip), and its name's: right of it, left of it, or below
    const arrow = [a.x - 2, a.x + 16], name = lead.side === "left" ? [a.x - tw - 4, a.x - 4] : lead.side === "below" ? [a.x + 10 - tw, a.x + 10] : [a.x + 15, a.x + 15 + tw];
    const top = a.y - 2, bottom = lead.side === "below" ? a.y + 31 + 22 : a.y + 20;
    /** @param {number} x */
    const sx = (x) => c.x + x * c.s;
    /** @param {number} y */
    const sy = (y) => c.y + y * c.s;
    let l = Math.min(arrow[0], name[0]), r = Math.max(arrow[1], name[1]);
    if (!tw || (r - l) * c.s > W - 2 * m) { l = arrow[0]; r = arrow[1]; } // no room for both: the arrow
    const ease = W * 0.12;
    let dx = 0, dy = 0;
    if (sx(l) < m) dx = Math.min(m + ease - sx(l), W - m - sx(r)); else if (sx(r) > W - m) dx = Math.max(W - m - ease - sx(r), m - sx(l));
    if (sy(top) < m) dy = m + H * 0.12 - sy(top); else if (sy(bottom) > H - m) dy = H - m - H * 0.12 - sy(bottom);
    if (dx || dy) { c.x += dx; c.y += dy; applyCam(c, true); }
  }


  /** @param {CameraScope} scope @param {CameraLayout} old @param {CameraLayout} L */
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
  return { applyCam, camOf, centerOn, fit, frame, holdStill, keepInView, reframe, zoomAt };
}
