// @ts-check

// Time words. Formatters are made once: toLocale*String with options builds one per call (25 ms per 400-row redraw).

/** Parse an ISO time ("…Z") into epoch ms, or NaN. @param {string | null | undefined} iso */
export function toMs(iso) {
  if (!iso) return NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

const CLOCK_F = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY_F = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
/** @param {number} ms */
export function clock(ms) {
  return CLOCK_F.format(ms);
}
/** @param {number} ms */
export function dayOf(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), y = new Date(now - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return DAY_F.format(d);
}
/** @param {number} ms */
export function short(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}
/** @param {number} secs */
export function elapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${String(secs % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
/** How long since `ms`, in elapsed()'s words; "" for no time. @param {number} ms */
export const since = (ms, now = Date.now()) => (Number.isFinite(ms) ? elapsed(Math.max(0, Math.floor((now - ms) / 1000))) : "");
