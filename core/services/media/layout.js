// @ts-check

/** Each side's largest box keeps its pictures inside the prose width. */
export const LIMITS = { them: { w: 560, h: 480 }, you: { w: 320, h: 320 } };
/** Under this on both sides, a picture shows at its own size in a tile this big. */
export const TINY = 96;
/** Narrower than this (w/h), a capture is cropped from its top: you see the page's header, not its middle. */
export const LONG = 0.4;
/** Wider than this, a banner keeps at least TINY of height, letterboxed. */
export const BANNER = 5;
/** Between album tiles; the canvas shows through. */
export const GAP = 2;
/** An album shows at most this many tiles; the last reads "+N". */
export const MAX_TILES = 4;
/** The frame a picture of unknown size is fitted into: 16:10, the shape of most screens. */
export const FRAME = 16 / 10;

/** @param {number} x @param {number} lo @param {number} hi */
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** @param {number[]} xs */
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
/** @param {unknown} v */
const posNum = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);

/** A positive size, or null (null and missing both mean "unknown"). @param {unknown} v */
export function dim(v) {
  const n = posNum(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** The server's tint as a CSS colour, or null. Only plain hex and rgb() pass. @param {unknown} t */
export function safeTint(t) {
  const s = String(t ?? "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+%?\s*)?\)$/i.test(s)) return s;
  return null;
}

/** @param {number | string | null | undefined} w @param {number | string | null | undefined} h @param {number} maxW @param {number} maxH */
export function fitImage(w, h, maxW, maxH) {
  w = dim(w); h = dim(h);
  if (!w || !h) return { w: maxW, h: Math.min(maxH, Math.round(maxW / FRAME)), mode: "frame" };
  if (w < TINY && h < TINY) return { w: TINY, h: TINY, mode: "tiny", iw: w, ih: h };
  const r = w / h;
  if (r < LONG) {
    const s = Math.min(1, maxW / w);
    if (h * s > maxH) return { w: Math.max(1, Math.round(w * s)), h: maxH, mode: "long" };
  }
  const s = Math.min(1, maxW / w, maxH / h);
  const bw = Math.max(1, Math.round(w * s)), bh = Math.max(1, Math.round(h * s));
  if (r > BANNER && bh < TINY) return { w: bw, h: TINY, mode: "banner" };
  return { w: bw, h: bh, mode: "fit" };
}

/** Integer widths that sum to `total`, in proportion to `ratios` (largest remainder, so no pixel is lost). @param {number} total @param {number[]} ratios */
function share(total, ratios) {
  const S = sum(ratios);
  const raw = ratios.map((r) => (total * r) / S);
  const out = raw.map(Math.floor);
  let left = total - sum(out);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

/** @param {(number | null | undefined)[]} ratios @param {{W: number, maxH: number, gap?: number}} [bounds] */
export function albumLayout(ratios, { W, maxH, gap = GAP } = /** @type {{W: number, maxH: number}} */ ({})) {
  const n = ratios.length;
  const r = ratios.map((x) => clamp(Number.isFinite(x) && /** @type {number} */ (x) > 0 ? /** @type {number} */ (x) : FRAME, 0.5, 2));
  let rows, caps;
  if (n <= 2) { rows = [r.map((_, i) => i)]; caps = [maxH]; }
  else if (n === 3) {
    if (r[0] >= 1.2) { rows = [[0], [1, 2]]; caps = [0.6 * maxH, maxH]; }
    else { rows = [[0, 1, 2]]; caps = [maxH]; }
  } else { rows = [[0, 1], [2, 3]]; caps = [(maxH - gap) / 2, (maxH - gap) / 2]; }
  const S = rows.map((row) => sum(row.map((i) => r[i])));
  const G = rows.map((row) => (row.length - 1) * gap);
  // a row of width Wa is (Wa − its gaps) / S tall: the widest Wa under each cap, then under maxH in all
  let Wa = W;
  rows.forEach((_, k) => { Wa = Math.min(Wa, caps[k] * S[k] + G[k]); });
  Wa = Math.min(Wa, (maxH - (rows.length - 1) * gap + sum(G.map((g, k) => g / S[k]))) / sum(S.map((s) => 1 / s)));
  Wa = Math.max(1, Math.floor(Wa));
  const out = rows.map((row, k) => ({
    h: Math.max(1, Math.round((Wa - G[k]) / S[k])),
    tiles: share(Wa - G[k], row.map((i) => r[i])).map((w, j) => ({ i: row[j], w })),
  }));
  return { w: Wa, h: sum(out.map((x) => x.h)) + (out.length - 1) * gap, rows: out, more: n > MAX_TILES ? n - (MAX_TILES - 1) : 0 };
}
