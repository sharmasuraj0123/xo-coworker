// @ts-check
import { clock, formatDate, isSoon } from "../../platform/time.js";

const NB = "\u00a0"; // a time is one phrase: it never breaks across lines ("1:31" / "AM")
/** @typedef {{until?: string | null, for?: string | null, asked?: boolean, why?: string | null}} Hold */

/** @param {string} t */
const nb = (t) => String(t).replace(/[ \u202f]/g, NB);
/** @param {string | null | undefined} iso @param {number} now */
function whenParts(iso, now) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms), t = new Date(now), next = new Date(now);
  next.setDate(next.getDate() + 1);
  const hm = clock(ms);
  if (d.toDateString() === t.toDateString()) return { day: "", hm };
  if (d.toDateString() === next.toDateString()) return { day: "tomorrow", hm };
  if (isSoon(ms, now)) return { day: formatDate(d, "weekday"), hm };
  return { day: formatDate(d, "monthDay"), date: true, hm };
}
/** @param {string | null | undefined} iso */
export function heldClock(iso, now = Date.now()) {
  const w = whenParts(iso, now);
  return w ? nb(w.day ? `${w.day} ${w.hm}` : w.hm) : "";
}
/** @param {string | null | undefined} iso @param {number} now */
function whenWords(iso, now) {
  const w = whenParts(iso, now);
  return w ? nb(`${w.date ? `on ${w.day} ` : w.day ? `${w.day} ` : ""}at ${w.hm}`) : "";
}
/** @param {Hold | null | undefined} h @param {number} now */
const ahead = (h, now) => !!(h && h.until && Date.parse(h.until) > now);

/** @param {Hold | null | undefined} h */
export function heldWords(h, now = Date.now()) {
  if (!h) return "";
  const at = ahead(h, now) ? whenWords(h.until, now) : "";
  switch (h.for) {
    case "limit": return at ? `Waiting for the usage limit · starts${NB}${at}` : "Waiting for the usage limit to reset";
    case "paid": return h.asked ? "Waiting for your choice on paid usage · it's in Needs you" : "Waiting before paid usage · see Settings › Runtimes";
    case "near_limit": return "Waiting · near the usage limit, more urgent work goes first";
    case "founder": return at ? `Paused by you · until ${at.replace(/^at\u00a0/, "")}` : "Paused by you";
    default: return !h.why ? "Waiting to start" : /^waiting\b/i.test(h.why) ? h.why.replace(/^w/, "W") : `Waiting · ${h.why}`;
  }
}

/** @param {Hold | null | undefined} h */
export const heldBadge = (h) => (h && h.for === "founder" ? "Paused" : "Waiting");

/** @param {Hold | null | undefined} h */
export function heldShort(h, now = Date.now()) {
  if (!h) return "";
  if (h.for === "founder") return "Paused";
  return h.for === "limit" && ahead(h, now) ? `Starts ${heldClock(h.until, now)}` : "Waiting";
}

/** @template {Hold} T @param {readonly T[] | null | undefined} list */
export function soonestHeld(list, now = Date.now()) {
  const hs = (list || []).filter(Boolean);
  const timed = hs.filter((h) => ahead(h, now)).sort((a, b) => Date.parse(/** @type {string} */ (a.until)) - Date.parse(/** @type {string} */ (b.until)));
  return timed[0] || hs[0] || null;
}
