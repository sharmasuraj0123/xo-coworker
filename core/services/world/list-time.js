// @ts-check
const DAY = 86400000;
/** @param {Date} d */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** @param {string} iso */
export function dayGroup(iso, now = new Date()) {
  const t = new Date(Date.parse(iso)), ms = t.getTime(), day = startOfDay(now);
  if (!Number.isFinite(ms)) return "Earlier";
  if (ms >= day) return "Today";
  if (ms >= day - DAY) return "Yesterday";
  if (ms >= day - 6 * DAY) return "This week";
  return t.toLocaleDateString(undefined, t.getFullYear() === now.getFullYear() ? { month: "long" } : { month: "long", year: "numeric" });
}
/** @param {string} iso */
export function rowTime(iso, now = new Date()) {
  const t = new Date(Date.parse(iso)), ms = t.getTime(), day = startOfDay(now);
  if (!Number.isFinite(ms)) return "";
  if (ms >= day - DAY) return t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (ms >= day - 6 * DAY) return t.toLocaleDateString(undefined, { weekday: "short" });
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
