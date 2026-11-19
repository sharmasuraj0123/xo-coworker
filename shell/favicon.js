// @ts-check

// The progress line, XO's one motif, in the browser tab: a line, never a dot, never a badge that counts up.

/** @type {{ key: string | null, plain: string | null }} */
const FAVICON = { key: null, plain: null };
/** The tab's mark: the latest working thread's steps on its foot, one amber line while something needs you, else plain. @param {any} t */
export function faviconRender(t, need = false) {
  const c = !need && t && t.checklist;
  const n = c && c.total ? Math.min(c.total, 6) : 0;
  const done = n ? Math.min(n, Math.round((c.done / c.total) * n)) : 0;
  const key = need ? "need" : t ? `${n}:${done}` : "";
  if (FAVICON.key === key) return;
  FAVICON.key = key;
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  if (FAVICON.plain == null) FAVICON.plain = link.getAttribute("href");
  if (!t && !need) { link.setAttribute("href", /** @type {string} */ (FAVICON.plain)); return; }
  // the mark raised 5, the line on its foot, on a 48 grid (assets/icons/xo/g-app-icon)
  const W = 28.5, X = 9.75, GAP = 1.5, k = n || 1, w = (W - GAP * (k - 1)) / k;
  const fill = (/** @type {number} */ i) => (need ? "#F5A623" : !n ? "#75ADF1" : i < done ? "#83D63A" : i === done ? "#75ADF1" : "#4A4A4A");
  const seg = Array.from({ length: k }, (_, i) => `<rect x="${(X + i * (w + GAP)).toFixed(2)}" y="35" width="${w.toFixed(2)}" height="2.5" rx="1.25" fill="${fill(i)}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#151515"/><path d="M10.4 13.8l5.2 5.2-5.2 5.2M23.2 13.8L18 19l5.2 5.2" fill="none" stroke-width="3" stroke="#E1E1E1"/><path d="M32 13.8L26.8 19l5.2 5.2M34.4 13.8l5.2 5.2-5.2 5.2" fill="none" stroke-width="3" stroke="#83D63A"/>${seg}</svg>`;
  link.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(svg)}`);
}
