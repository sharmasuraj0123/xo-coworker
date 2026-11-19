// @ts-check

// A long list laid out as lines (a group's heading, a row of cards) at places worked out from measured sizes, so only the lines near the screen are drawn.

/** @template G @typedef {{ key: string, kind: "head", y: number, h: number, g: G } | { key: string, kind: "row", y: number, h: number, g: G, start: number, n: number } | { key: "sk", kind: "tail", y: number, h: number, rows: number }} Line */

/** Groups as lines, top to bottom: a heading `headH` tall, then rows of `cols` cards `cardH` tall with `gap` between; `tail` stand-in rows at the end. @template {{ id: string, items: unknown[] }} G @param {G[]} groups @param {{ cols?: number, cardH: number, headH: number, gap?: number, tail?: number }} opts @returns {{ lines: Line<G>[], height: number }} */
export function galleryLines(groups, { cols = 1, cardH, headH, gap = 0, tail = 0 }) {
  const c = Math.max(1, Math.floor(cols));
  /** @type {Line<G>[]} */
  const lines = [];
  let y = 0;
  for (const g of groups) {
    lines.push({ key: `h:${g.id}`, kind: "head", y, h: headH, g });
    y += headH;
    const rows = Math.ceil(g.items.length / c);
    for (let r = 0; r < rows; r++) {
      const start = r * c;
      lines.push({ key: `r:${g.id}:${r}`, kind: "row", y, h: cardH, g, start, n: Math.min(c, g.items.length - start) });
      y += cardH + (r < rows - 1 ? gap : 0);
    }
  }
  if (tail > 0) {
    y += lines.length ? gap : 0;
    const h = tail * cardH + (tail - 1) * gap;
    lines.push({ key: "sk", kind: "tail", y, h, rows: tail });
    y += h;
  }
  return { lines, height: y };
}

/** The lines that reach into [lo, hi] (px from the top), in order, by a binary search for the first; lines are sorted by y. @template {{ y: number, h: number }} L @param {L[]} lines @param {number} lo @param {number} hi */
export function linesIn(lines, lo, hi) {
  let a = 0, b = lines.length;
  while (a < b) { const m = (a + b) >> 1; if (lines[m].y + lines[m].h < lo) a = m + 1; else b = m; }
  const out = [];
  for (let i = a; i < lines.length && lines[i].y <= hi; i++) out.push(lines[i]);
  return out;
}
