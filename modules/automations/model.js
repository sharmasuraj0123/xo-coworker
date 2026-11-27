// @ts-check

import { DAY_MS, clock, formatDate, startOfDay, toMs } from "../../core/platform/time.js";
import { count } from "../../core/platform/words.js";
import { foundOf, iconOf } from "./pending.js";

/** @import { ScheduledJob, ScheduleResult, ScheduleRun } from "../../core/platform/schedule-response-types" */

/** @import { Automation, Cadence, LastRun, RunRow, AgendaDay, WeekDay } from "./types" */

const HOUR = 3600, DAY = 86400, WEEK = 7 * DAY;
const MAX_UPCOMING = 400;

/** @param {ScheduleResult | ScheduleRun} result @returns {LastRun} */
function runOf(result) {
  const at = toMs(result.fire_at ?? result.started_at);
  const thread = result.chat_id && result.thread_ts ? { chat: result.chat_id, ts: result.thread_ts } : null;
  const skipped = result.status === "skipped";
  const failed = result.status === "failed" || result.status === "lost";
  return { at, status: skipped ? "skipped" : failed ? "failed" : "ok", found: foundOf(result), reason: result.reason ?? "", thread,
    manual: result.trigger === "manual" };
}

/** @param {ScheduledJob} job @returns {job is Extract<ScheduledJob, { kind: "agent" }>} */
const isAgentJob = (job) => job.kind === "agent";

/** @param {ScheduledJob[]} jobs @returns {Automation[]} */
export const automationsOf = (jobs) => jobs.filter(isAgentJob).map(automationOf);

/** @param {Extract<ScheduledJob, { kind: "agent" }>} job @returns {Automation} */
function automationOf(job) {
  const off = job.enabled ? null : job.disabled_by ?? { kind: "person" };
  return {
    id: job.id, name: job.name, about: job.description ?? "", project: job.chat, prompt: job.prompt,
    on: job.enabled, running: job.running, every: job.every_seconds, anchor: toMs(job.first_run_at),
    next: job.enabled ? toMs(job.next_run) : NaN, last: job.last_result ? runOf(job.last_result) : null,
    offReason: off ? offWords(off) : "", runtime: job.agent, model: job.model, effort: job.effort,
    askedBy: job.created_by?.kind === "person" ? "you" : "agent", approved: !!job.approved_by, icon: iconOf(job), job,
  };
}

/** @param {{ kind: string, reason?: string }} by */
const offWords = (by) => by.kind === "person" ? "Turned off by you" : by.reason || "Turned off by XO";

/** @param {Automation} a @returns {Cadence} */
export function cadenceOf(a) {
  const at = Number.isFinite(a.next) ? a.next : a.anchor;
  const every = a.every;
  if (every === null) return { kind: "once", at, step: 0 };
  if (every % WEEK === 0) return { kind: "week", at, step: every / WEEK };
  if (every % DAY === 0) return { kind: "day", at, step: every / DAY };
  if (every % HOUR === 0) return { kind: "hour", at, step: every / HOUR };
  return { kind: "minute", at, step: Math.max(1, Math.round(every / 60)) };
}

/** How often, in words: "Every day at 9:00 AM", "Mondays at 9:00 AM", "Every 6 hours". @param {Automation} a */
export function cadenceWords(a) {
  const { kind, at, step } = cadenceOf(a);
  const time = Number.isFinite(at) ? clock(at) : "";
  const atTime = time ? ` at ${time}` : "";
  if (kind === "once") return Number.isFinite(at) ? `Once, ${formatDate(at, "monthDay")}${atTime}` : "Once";
  if (kind === "week") {
    const day = Number.isFinite(at) ? formatDate(at, "fullWeekday") : "week";
    return step === 1 ? `Every ${day}${atTime}` : `Every ${step} weeks on ${day}${atTime}`;
  }
  if (kind === "day") return step === 1 ? `Every day${atTime}` : `Every ${count(step, "day")}${atTime}`;
  if (kind === "hour") return step === 1 ? "Every hour" : `Every ${count(step, "hour")}`;
  return step === 1 ? "Every minute" : `Every ${count(step, "minute")}`;
}

/** The run times from `from` up to `until`, from the next run on. @param {Automation} a @param {number} from @param {number} until */
function upcoming(a, from, until) {
  if (!a.on || !Number.isFinite(a.next)) return [];
  if (a.every === null) return a.next >= from && a.next < until ? [a.next] : [];
  const step = a.every * 1000, out = [];
  let at = a.next < from ? a.next + Math.ceil((from - a.next) / step) * step : a.next;
  for (; at < until && out.length < MAX_UPCOMING; at += step) out.push(at);
  return out;
}

/** This week from Monday, a dot per automation running that day. @param {Automation[]} list @param {number} now @returns {WeekDay[]} */
export function weekOf(list, now) {
  const today = startOfDay(new Date(now));
  const monday = dayStart(today, -((new Date(today).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const start = dayStart(monday, i), end = dayStart(monday, i + 1);
    const dots = list.flatMap((a) => upcoming(a, Math.max(start, now), end).slice(0, 1)
      .map((at) => ({ id: a.id, icon: a.icon, at })));
    return { start, today: start === today, past: end <= now, dots: dots.sort((x, y) => x.at - y.at) };
  });
}

/** Each day's first run of each: Today, Tomorrow, then weekdays. @param {Automation[]} list @param {number} now @returns {AgendaDay[]} */
export function agendaOf(list, now, days = 7) {
  const today = startOfDay(new Date(now));
  return Array.from({ length: days }, (_, i) => {
    const start = dayStart(today, i), end = dayStart(today, i + 1);
    const items = list.flatMap((a) => upcoming(a, Math.max(start, now), end).slice(0, 1).map((at) => ({ automation: a, at })))
      .sort((x, y) => x.at - y.at);
    return { start, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(start, "fullWeekday"), items };
  }).filter((day) => day.items.length);
}

/** A date on weekday `d` (0 is Sunday), to name it. @param {number} d */
export const dayAt = (d) => new Date(2026, 10, 22 + (d || 7));

/** Local midnight `n` days after `start`, through DST changes. @param {number} start @param {number} n */
const dayStart = (start, n) => startOfDay(new Date(start + n * DAY_MS + DAY_MS / 2));

/** @param {ScheduleRun[]} runs @returns {RunRow[]} */
export const runRowsOf = (runs) => runs.map((run) => ({ ...runOf(run), key: `${run.job_id}:${run.ts}` }));

/** Runs worth a look: found something or failed, newest first. @param {Automation[]} list */
export const noticedOf = (list) => list.filter((a) => a.last && (a.last.found === true || a.last.status === "failed"))
  .sort((x, y) => (y.last?.at ?? 0) - (x.last?.at ?? 0));
