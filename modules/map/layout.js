// @ts-check

// The Map's drawing, pure: box sizes, an agent's colour, a folder tree laid out left to right, and the connectors between boxes.

/** @import { Point } from "./camera-types.d.ts" */

/** @typedef {{ nw?: number, nh?: number, r?: number }} ConnectorOptions */

export const NW = 148, NH = 32, PAD = 28; // compact: two columns read at 360px
const COL = 184, ROW = 42;
const PALETTE = ["#4C8DFF", "#A472FF", "#FF6FAE", "#FF9F43", "#2EC4B6", "#E5C23A"];

/** @template T @typedef {T & {x: number, y: number}} LayoutNode */

/** An agent's colour: the same agent keeps it, wherever it shows. @param {unknown} id */
export function colorOf(id) {
  let hash = 7;
  for (const letter of String(id)) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** @template {{id: string, children?: T[]}} T @param {T} root @param {{col?: number, row?: number, nw?: number, nh?: number}} [opts] */
export function layoutOf(root, { col = COL, row = ROW, nw = NW, nh = NH } = {}) {
  /** @type {LayoutNode<T>[]} */
  const nodes = [];
  /** @type {{from: LayoutNode<T>, to: LayoutNode<T>}[]} */
  const edges = [];
  let y = 0;
  /** @param {T} n @param {number} depth @param {LayoutNode<T> | null} parent @returns {LayoutNode<T>} */
  const place = (n, depth, parent) => {
    const node = Object.assign(n, { x: depth * col, y });
    const children = n.children ?? [];
    if (!children.length) {
      y += row;
    } else {
      const placed = children.map((child) => place(child, depth + 1, node));
      node.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    }
    nodes.push(node);
    if (parent) edges.push({ from: parent, to: node });
    return node;
  };
  place(root, 0, null);
  const w = Math.max(...nodes.map((n) => n.x)) + nw;
  return { nodes, edges, w, h: Math.max(row, y) - row + nh };
}

/** @param {Point} p @param {Point} c @param {ConnectorOptions} [opts] */
export function edgePath(p, c, { nw = NW, nh = NH, r = 8 } = {}) {
  const x1 = p.x + nw, y1 = p.y + nh / 2, x2 = c.x, y2 = c.y + nh / 2;
  const xm = x1 + Math.min(28, (x2 - x1) / 2);
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
  const d = y2 > y1 ? 1 : -1, rr = Math.min(r, Math.abs(y2 - y1) / 2);
  return `M${x1} ${y1}H${xm - rr}Q${xm} ${y1} ${xm} ${y1 + d * rr}V${y2 - d * rr}Q${xm} ${y2} ${xm + rr} ${y2}H${x2}`;
}
