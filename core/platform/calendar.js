// @ts-check

export const DAY_MS = 86400000;

const CLOCK = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const DATES = {
  weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
  fullWeekday: new Intl.DateTimeFormat(undefined, { weekday: "long" }),
  monthDay: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }),
  month: new Intl.DateTimeFormat(undefined, { month: "long" }),
  monthYear: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
};

/** @param {Date} date */
export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** @param {number | Date} date @param {keyof typeof DATES} style */
export function formatDate(date, style) {
  return Number.isFinite(Number(date)) ? DATES[style].format(date) : new Date(NaN).toLocaleDateString();
}

/** @param {number} ms */
export function clock(ms) {
  return CLOCK.format(ms);
}

/** @param {number} ms */
export function dayOf(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), y = new Date(now - DAY_MS);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return DAY.format(d);
}

/** @param {number} ms @param {number} now */
export const isSoon = (ms, now) => ms > now && ms - now < 6 * DAY_MS;

/** @param {string} iso */
export function clockWords(iso, now = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms), hm = clock(ms);
  if (d.toDateString() === new Date(now).toDateString()) return hm;
  if (isSoon(ms, now)) return `${formatDate(d, "weekday")} ${hm}`;
  return `${formatDate(d, "monthDay")}, ${hm}`;
}
