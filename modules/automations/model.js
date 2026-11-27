// @ts-check

import { DAY_MS, formatDate, startOfDay, toMs } from "../../core/platform/time.js";
import { count } from "../../core/platform/words.js";
import { foundOf, iconOf } from "./pending.js";

/** @import { AgentFire, AgentRun, ScheduledJob, ScheduleResult, ScheduleRun } from "../../core/platform/schedule-response-types" */

/** @import { Automation, Cadence, LastRun, Project, RunRow, AgendaDay, WeekDay } from "./types" */

const HOUR = 3600, DAY = 86400, WEEK = 7 * DAY;
const MAX_UPCOMING = 400;

/** @typedef {{ id: string, name: string, kind: string, chatId?: string | null, hasChat?: boolean }} WorldProject */

/** Where a job runs and an agent lives: a project with a chat, never the Workspace. @param {WorldProject[]} all @returns {Project[]} */
export const projectsOf = (all) => all.flatMap((p) => p.chatId && p.hasChat !== false && p.kind !== "workspace"
  ? [{ chat: p.chatId, name: p.name, id: p.id }] : []);

/** @param {ScheduleResult | ScheduleRun | AgentFire | AgentRun} r */
const atOf = (r) => toMs("at" in r ? r.at : "started_at" in r ? r.fire_at ?? r.started_at : r.fire_at);

/** @param {ScheduleResult | ScheduleRun | AgentFire | AgentRun} r @returns {LastRun["thread"]} */
const threadOf = (r) => "thread" in r && r.thread ? { chat: r.thread.chat_id, ts: r.thread.ts }
  : "chat_id" in r && r.chat_id && r.thread_ts ? { chat: r.chat_id, ts: r.thread_ts } : null;

/** @param {ScheduleResult | ScheduleRun | AgentFire | AgentRun} result @returns {LastRun} */
function runOf(result) {
  const skipped = result.status === "skipped";
  const failed = result.status === "failed" || result.status === "lost";
  return { at: atOf(result), status: skipped ? "skipped" : failed ? "failed" : "ok", found: foundOf(result), reason: result.reason ?? "",
    summary: result.summary ?? "", thread: threadOf(result), manual: result.trigger === "manual",
    count: typeof result.found_count === "number" ? result.found_count : null };
}

/** @param {ScheduledJob} job @returns {job is Extract<ScheduledJob, { kind: "agent" }>} */
const isAgentJob = (job) => job.kind === "agent";

/** @param {ScheduledJob[]} jobs @returns {Automation[]} */
export const automationsOf = (jobs) => jobs.filter(isAgentJob).map(automationOf);

/** @param {Extract<ScheduledJob, { kind: "agent" }>} job @returns {Automation} */
function automationOf(job) {
  const rule = job.schedule && !("every_seconds" in job.schedule) ? job.schedule : null;
  return {
    id: job.id, name: job.name, about: job.description ?? "", project: job.chat, prompt: job.prompt,
    on: job.enabled, running: job.running, every: job.every_seconds, rule, upcoming: (job.upcoming ?? []).map(toMs),
    anchor: toMs(job.first_run_at), since: toMs(job.created_at ?? job.first_run_at), next: job.enabled ? toMs(job.next_run) : NaN,
    last: job.last_result ? runOf(job.last_result) : null,
    offReason: job.enabled ? "" : offWords(job), runtime: job.agent, model: job.model, effort: job.effort,
    askedBy: job.created_by?.kind === "person" ? "you" : "agent", approved: !!job.approved_by, persona: job.persona ?? null,
    icon: iconOf(job), notify: job.notify ?? null, onFailure: job.on_failure ?? null, job,
  };
}

/** "Found 2 things", or "Found something" when the run gave no count. @param {LastRun} run */
export const foundWords = (run) => run.count === null || run.count < 1 ? "Found something"
  : `Found ${run.count} ${run.count === 1 ? "thing" : "things"}`;

/** What XO Space says when it was saved turned off. */
const SAVED_OFF = "Saved turned off.";

/** @param {Extract<ScheduledJob, { kind: "agent" }>} job */
function offWords(job) {
  if (job.state === "fired") return "Done: it ran once";
  const why = job.state_reason || job.disabled_by?.reason || "";
  const at = toMs(job.disabled_by?.at), when = Number.isFinite(at) ? `, ${dayMonth(at)}` : "";
  return !why || why === SAVED_OFF ? `Turned off by you${when}` : why;
}

/** A time on the 24-hour clock, as automations show it: "08:30". @param {number} ms */
export const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** "27 November". @param {number} ms */
export const dateWords = (ms) => `${new Date(ms).getDate()} ${formatDate(ms, "month")}`;

/** The day and its month, short. @param {number} ms */
export const dayMonth = (ms) => `${new Date(ms).getDate()} ${formatDate(ms, "month").slice(0, 3)}`;

/** "Friday 27 November". @param {number} ms */
export const longDate = (ms) => `${formatDate(ms, "fullWeekday")} ${dateWords(ms)}`;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WORK_DAYS = [1, 2, 3, 4, 5];

/** A calendar rule's days, 0 for Sunday. @param {NonNullable<Automation["rule"]>} rule */
const ruleDays = (rule) => !("days" in rule) ? [] : rule.days === "weekdays" ? WORK_DAYS
  : rule.days.map((d) => DAY_KEYS.indexOf(d)).filter((d) => d >= 0).sort((x, y) => x - y);

/** A rule's wall time today, when nothing says when it runs next. @param {string} time @param {number} now */
const wallTime = (time, now) => {
  const [h, m] = time.split(":").map(Number);
  return startOfDay(new Date(now)) + ((h || 0) * 60 + (m || 0)) * 60_000;
};

/** @param {Automation} a @returns {Cadence} */
export function cadenceOf(a, now = Date.now()) {
  const rule = a.rule;
  const at = Number.isFinite(a.next) ? a.next : rule ? wallTime(rule.time, now) : a.anchor;
  if (rule) {
    if ("day_of_month" in rule) return { kind: "month", at, step: 1, days: [], dom: rule.day_of_month };
    const days = ruleDays(rule);
    const kind = days.length === 7 ? "day" : days.length === 1 ? "week" : "days";
    return { kind, at, step: 1, days, dom: null };
  }
  const every = a.every, day = Number.isFinite(at) ? [new Date(at).getDay()] : [];
  if (every === null) return { kind: "once", at, step: 0, days: [], dom: null };
  if (every % WEEK === 0) return { kind: "week", at, step: every / WEEK, days: day, dom: null };
  if (every % DAY === 0) return { kind: "day", at, step: every / DAY, days: [0, 1, 2, 3, 4, 5, 6], dom: null };
  if (every % HOUR === 0) return { kind: "hour", at, step: every / HOUR, days: [], dom: null };
  return { kind: "minute", at, step: Math.max(1, Math.round(every / 60)), days: [], dom: null };
}

/** @param {number} n */
export const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** "Weekdays", "Mon, Wed and Fri". @param {number[]} days */
function daysWords(days) {
  if (days.join() === WORK_DAYS.join()) return "Weekdays";
  if (days.join() === "0,6") return "Weekends";
  const names = [...days].sort((x, y) => (x || 7) - (y || 7)).map((d) => formatDate(dayAt(d), "weekday"));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

/** How often, in words: "Every day", "Weekdays", "Mondays", "Every 6 hours". @param {Automation} a */
export function cadenceWords(a) {
  const { kind, at, step, days, dom } = cadenceOf(a);
  if (kind === "once") return Number.isFinite(at) ? `Once, ${dateWords(at)}` : "Once";
  if (kind === "month") return `Monthly, on the ${dom === "last" ? "last day" : ordinal(Number(dom))}`;
  if (kind === "days") return daysWords(days);
  if (kind === "week") {
    const day = days.length ? formatDate(dayAt(days[0]), "fullWeekday") : "week";
    return step === 1 ? `${day}s` : `Every ${step} weeks on ${day}`;
  }
  if (kind === "day") return step === 1 ? "Every day" : `Every ${count(step, "day")}`;
  if (kind === "hour") return step === 1 ? "Every hour" : `Every ${count(step, "hour")}`;
  return step === 1 ? "Every minute" : `Every ${count(step, "minute")}`;
}

/** The days a calendar rule runs on, for its letters, or null when it isn't one. @param {Automation} a */
export const ruleWeek = (a) => a.rule && "days" in a.rule ? ruleDays(a.rule) : null;

/** The run times from `from` up to `until`, from the next run on. @param {Automation} a @param {number} from @param {number} until */
function upcoming(a, from, until) {
  if (!a.on || !Number.isFinite(a.next)) return [];
  if (a.rule) return (a.upcoming.length ? a.upcoming : [a.next]).filter((at) => at >= from && at < until);
  if (a.every === null) return a.next >= from && a.next < until ? [a.next] : [];
  const step = a.every * 1000, out = [];
  let at = a.next < from ? a.next + Math.ceil((from - a.next) / step) * step : a.next;
  for (; at < until && out.length < MAX_UPCOMING; at += step) out.push(at);
  return out;
}

/** Whether its schedule ran it on the day from `start` to `end`. @param {Automation} a @param {number} start @param {number} end */
function ranOn(a, start, end) {
  if (!a.on || (Number.isFinite(a.since) && a.since >= end)) return false;
  if (a.rule) {
    const day = new Date(start);
    if ("day_of_month" in a.rule) {
      const last = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
      return day.getDate() === (a.rule.day_of_month === "last" ? last : a.rule.day_of_month);
    }
    return ruleDays(a.rule).includes(day.getDay());
  }
  if (a.every === null || !Number.isFinite(a.next)) return false;
  const step = a.every * 1000, at = a.next - Math.ceil((a.next - start) / step) * step;
  return at < end && (!Number.isFinite(a.anchor) || at >= a.anchor);
}

/** This week from Monday, a dot per automation run that day. @param {Automation[]} list @param {number} now @returns {WeekDay[]} */
export function weekOf(list, now) {
  const today = startOfDay(new Date(now));
  const monday = dayStart(today, -((new Date(today).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const start = dayStart(monday, i), end = dayStart(monday, i + 1);
    const dots = list.flatMap((a) => {
      const at = upcoming(a, Math.max(start, now), end)[0] ?? (start < now && ranOn(a, start, end) ? start : NaN);
      return Number.isFinite(at) ? [{ id: a.id, icon: a.icon, at }] : [];
    });
    return { start, today: start === today, past: end <= now, dots: dots.sort((x, y) => x.at - y.at) };
  });
}

/** Each automation once, at its next run, by day. @param {Automation[]} list @param {number} now @returns {AgendaDay[]} */
export function agendaOf(list, now, days = 7) {
  const today = startOfDay(new Date(now)), until = dayStart(today, days);
  const next = list.flatMap((a) => upcoming(a, now, until).slice(0, 1).map((at) => ({ automation: a, at })));
  return Array.from({ length: days }, (_, i) => {
    const start = dayStart(today, i), end = dayStart(today, i + 1);
    const items = next.filter(({ at }) => at >= start && at < end).sort((x, y) => x.at - y.at);
    return { start, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(start, "fullWeekday"), items };
  }).filter((day) => day.items.length);
}

/** A date on weekday `d` (0 is Sunday), to name it. @param {number} d */
export const dayAt = (d) => new Date(2026, 10, 22 + (d || 7));

/** Local midnight `n` days after `start`, through DST changes. @param {number} start @param {number} n */
const dayStart = (start, n) => startOfDay(new Date(start + n * DAY_MS + DAY_MS / 2));

/** @param {(ScheduleRun | AgentRun)[]} runs @returns {RunRow[]} */
export const runRowsOf = (runs) => runs.map((run) => ({ ...runOf(run), key: "ts" in run ? `${run.job_id}:${run.ts}` : run.fire_at }));

/** Runs worth a look: found something or failed, newest first. @param {Automation[]} list */
export const noticedOf = (list) => list.filter((a) => a.last && (a.last.found === true || a.last.status === "failed"))
  .sort((x, y) => (y.last?.at ?? 0) - (x.last?.at ?? 0));
