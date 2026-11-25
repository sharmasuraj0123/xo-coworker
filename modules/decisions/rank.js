// @ts-check

// What each ask costs you (effort), what one answer frees (leverage), the order they come in, and the words behind one.

import { count } from "../../core/platform/words.js";
import * as Kit from "./kit.js";

/** @import { Effort, RankFields } from "../../core/services/decision-types.d.ts" */

/** @typedef {Pick<RankFields, "effort" | "lev" | "since"> & { later?: boolean, risk?: string }} Need */

/** @type {Record<Effort, { label: string, time: string, secs: number, long: string, you: string }>} */
export const EFFORT = {
  glance: { label: "Glance", time: "~5 s", secs: 5, long: "a 5-second glance", you: "5 s of you" },
  decide: { label: "Decide", time: "~1 min", secs: 60, long: "a one-minute decision", you: "1 min of you" },
  think: { label: "Think", time: "needs focus", secs: 300, long: "something that needs your focus", you: "a focused few minutes" },
};
const ERANK = { glance: 0, decide: 1, think: 2 };

/** @param {{ ask: { kind?: string, options?: unknown }, group?: string, risk?: string }} n @returns {Effort} */
export function effortOf(n) {
  if (n.group === "stopped") return "decide";
  const a = n.ask;
  if (n.risk === "destructive") return "think";
  if (a.kind === "action") return "think";
  if (Kit.isBinary(a)) return n.risk === "routine" ? "glance" : "decide";
  if (Array.isArray(a.options) && a.options.length && n.risk === "routine") return "glance";
  return "decide";
}

/** @param {{ t: { checklist: { total: number, done: number } }, group?: string }} n */
export function leverageOf(n) {
  const left = Math.max(1, n.t.checklist.total - n.t.checklist.done);
  if (n.group === "stopped") return { min: left * 24 + 20, steps: left };
  return { min: left * 21, steps: left };
}

/** @param {{ t: { checklist: { total: number, done: number } } }} n */
export function estLine(n) {
  const left = n.t.checklist.total - n.t.checklist.done;
  if (!n.t.checklist.total || left <= 0) return "";
  return `${count(left, "step")} left in its checklist`;
}


/** @param {Need} n */
export const bidOf = (n) => n.lev.min / EFFORT[n.effort].secs;

/** @template {Need} T @param {T[]} items */
export function rank(items) {
  return items.slice().sort((x, y) =>
    Number(x.risk === "destructive") - Number(y.risk === "destructive") ||
    (x.later ? 1 : 0) - (y.later ? 1 : 0) ||
    ERANK[x.effort] - ERANK[y.effort] ||
    bidOf(y) - bidOf(x) ||
    x.since - y.since);
}

/** @param {{ t: { happened?: string }, ask: { detail?: string, full?: string } }} n */
export function evidenceFor(n) {
  const a = n.ask, t = n.t;
  return { change: null, facts: [], preview: null, why: a.full || a.detail || t.happened || "The agent is waiting on you before it continues." };
}
