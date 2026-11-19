// @ts-check

// The Map's drawing, pure: box sizes, an agent's colour, a folder tree laid out left to right, and the connectors between boxes.

export const NW = 148, NH = 32, PAD = 28; // compact: two columns read at 360px
const COL = 184, ROW = 42;
const PALETTE = ["#4C8DFF", "#A472FF", "#FF6FAE", "#FF9F43", "#2EC4B6", "#E5C23A"];

/** @typedef {{ id: string, children?: Box[], x?: number, y?: number, [k: string]: any }} Box */

/** An agent's colour: the same agent keeps it, wherever it shows. @param {unknown} id */
export function colorOf(id) { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }

/** A tree left to right like a hand-drawn diagram: a level per column, a leaf per row, a parent centred on its children. @param {Box} root @param {{ col?: number, row?: number, nw?: number, nh?: number }} [opts] */
export function layoutOf(root, { col = COL, row = ROW, nw = NW, nh = NH } = {}) {
  /** @type {(Box & { x: number, y: number })[]} */
  const nodes = [];
  /** @type {{ from: Box, to: Box }[]} */
  const edges = [];
  let y = 0;
  /** @param {any} n @param {number} depth @param {Box | null} parent */
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

/** A connector: out of the parent's right side, along a shared trunk, into the child, corners rounded. @param {{ x: number, y: number }} p @param {{ x: number, y: number }} c @param {{ nw?: number, nh?: number, r?: number }} [opts] */
export function edgePath(p, c, { nw = NW, nh = NH, r = 8 } = {}) {
  const x1 = p.x + nw, y1 = p.y + nh / 2, x2 = c.x, y2 = c.y + nh / 2;
  const xm = x1 + Math.min(28, (x2 - x1) / 2);
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
  const d = y2 > y1 ? 1 : -1, rr = Math.min(r, Math.abs(y2 - y1) / 2);
  return `M${x1} ${y1}H${xm - rr}Q${xm} ${y1} ${xm} ${y1 + d * rr}V${y2 - d * rr}Q${xm} ${y2} ${xm + rr} ${y2}H${x2}`;
}
