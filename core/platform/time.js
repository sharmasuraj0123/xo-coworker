// @ts-check

import { formatDate } from "./calendar.js";
import { count } from "./words.js";
export { DAY_MS, startOfDay, formatDate, clock, dayOf, isSoon, clockWords } from "./calendar.js";

/** Parse an ISO time ("…Z") into epoch ms, or NaN. @param {string | null | undefined} iso */
export function toMs(iso) {
  if (!iso) return NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

/** @param {string} iso */
export function untilWords(iso, now = Date.now()) {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const m = Math.round((ms - now) / 60000);
  if (m <= 0) return "";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `in ${h} h${r ? ` ${r} min` : ""}`;
  return `in ${count(Math.round(h / 24), "day")}`;
}
/** @param {number} ms */
export function short(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return formatDate(ms, "weekday");
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
