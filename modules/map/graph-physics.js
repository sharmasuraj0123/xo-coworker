// @ts-check

/** @typedef {{ x: number, y: number, vx: number, vy: number }} Position */

/** @typedef {{ p: Position, par: Position | null, n: { kind: keyof typeof RAD }, ext?: { l: number, t: number, r: number, b: number } }} GraphNode */

export const RAD = { root: 11, project: 8, dir: 6, file: 3.6, more: 3, note: 2.5 };
const LINK = { root: 0, project: 120, dir: 96, file: 50, more: 40, note: 30 };

/** @param {{ gnodes: GraphNode[], alpha: number }} M @param {(v: number, a: number, b: number) => number} clamp */
export function gstep(M, clamp) {
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
// Resolve overlapping boxes after each step while keeping the root fixed.
const GAP = 6;
/** @param {GraphNode} g */
function gbox(g) {
  const r = RAD[g.n.kind] || 4, named = g.n.kind === "root" || g.n.kind === "project" || g.n.kind === "dir";
  const e = named && g.ext ? g.ext : { l: -r, t: -r, r, b: r };
  return { l: g.p.x + e.l - GAP / 2, t: g.p.y + e.t - GAP / 2, r: g.p.x + e.r + GAP / 2, b: g.p.y + e.b + GAP / 2 };
}
/** @param {GraphNode[]} G */
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
