// @ts-check
import { DAY_MS, clock, formatDate, startOfDay } from "../../platform/time.js";
/** @param {string} iso */
export function rowTime(iso, now = new Date()) {
  const t = new Date(Date.parse(iso)), ms = t.getTime(), day = startOfDay(now);
  if (!Number.isFinite(ms)) return "";
  if (ms >= day - DAY_MS) return clock(ms);
  if (ms >= day - 6 * DAY_MS) return formatDate(t, "weekday");
  return formatDate(t, "monthDay");
}
