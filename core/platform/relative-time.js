// @ts-check

import { DAY_MS } from "./calendar.js";
import { toMs } from "./time.js";
import { count } from "./words.js";

/** @param {string | null | undefined} iso @param {number} now */
function age(iso, now) {
  const timestamp = toMs(iso);
  if (!Number.isFinite(timestamp)) return null;
  const days = Math.max(0, now - timestamp) / DAY_MS;
  if (days < 1 / 24) return { value: Math.max(1, Math.round(days * 1440)), unit: "minute", suffix: "m" };
  if (days < 1) return { value: Math.round(days * 24), unit: "hour", suffix: "h" };
  if (days < 14) return { value: Math.round(days), unit: "day", suffix: "d" };
  if (days < 60) return { value: Math.round(days / 7), unit: "week", suffix: "w" };
  return { value: Math.round(days / 30), unit: "month", suffix: "mo" };
}

/** @param {string | null} [iso] */
export function relativeShort(iso, now = Date.now()) {
  const time = age(iso, now);
  return time ? `${time.value}${time.suffix}` : "";
}

/** @param {string | null} [iso] */
export function relativeWords(iso, now = Date.now()) {
  const time = age(iso, now);
  return time ? `${count(time.value, time.unit)} ago` : "";
}
