// The Now strip's fit (js/app.js nowEdges): with a pointer, the strip shows whole chips only and folds the rest into one
// "+N". Pure: widths in, how many fit out, so the strip measures its chips only when they or its width change, never
// on every redraw (each redraw measured all of them: 28 forced layouts on "Back to chat", the owner 19 Nov 12:06Z).

/**
 * widths: each chip's width; inner: the strip's inner width; gap between chips; more: the room the "+N" needs.
 * → {fit: chips shown, n: chips folded into "+N"}.
 */
export function fitChips(widths, inner, { gap = 6, more = 56 } = {}) {
  const all = widths.reduce((w, x, i) => w + x + (i ? gap : 0), 0);
  if (all <= inner + 2) return { fit: widths.length, n: 0 };
  const room = inner - more;
  let used = 0, fit = 0;
  for (const x of widths) { used += x + (fit ? gap : 0); if (used <= room) fit++; else break; }
  fit = Math.max(1, Math.min(fit, widths.length));
  return { fit, n: widths.length - fit };
}
