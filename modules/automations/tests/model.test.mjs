// @ts-check

import assert from "node:assert/strict";
import { agendaOf, automationsOf, cadenceWords, hhmm, longDate, noticedOf, runRowsOf, weekOf } from "../model.js";

const HOUR = 3600, DAY = 86400;
const now = new Date(2026, 10, 25, 8, 0).getTime();
const at = (/** @type {number} */ days, /** @type {number} */ hour, minute = 0) => new Date(2026, 10, 25 + days, hour, minute).toISOString();

/** @param {Record<string, unknown>} over */
const job = (over = {}) => ({
  id: "j1", name: "Morning check", kind: "agent", chat: "chat_a", prompt: "Look", utc_offset: "+00:00", agent: null, model: null,
  effort: null, description: null, enabled: true, running: false, every_seconds: DAY, first_run_at: at(-3, 9), next_run: at(0, 9),
  last_result: null, state: "armed", state_reason: null, schedule: { every_seconds: DAY }, persona: null, icon: null, upcoming: [], ...over,
});
const command = { id: "c1", name: "Backup", enabled: true, running: false, description: null, every_seconds: HOUR,
  next_run: null, last_run: null, running_since: null, last_result: null, project_id: null, command: { argv: ["x"], timeout: 5 } };

const automations = (jobs) => automationsOf(/** @type {never} */ (jobs));

/** @param {Record<string, unknown>} over */
const one = (over) => automations([job(over)])[0];

const list = automations([job(), command]);
assert.equal(list.length, 1, "command jobs aren't automations");
assert.equal(list[0].project, "chat_a");
assert.equal(list[0].icon, "automation", "no icon from XO Space: the automation icon");

const [daily] = list;
assert.equal(cadenceWords(daily), "Every day", "the time has its own column");
assert.equal(cadenceWords(one({ every_seconds: 7 * DAY })), "Wednesdays");
assert.equal(cadenceWords(one({ every_seconds: 6 * HOUR })), "Every 6 hours");
assert.equal(cadenceWords(one({ every_seconds: 3 * DAY })), "Every 3 days");
assert.equal(cadenceWords(one({ every_seconds: null })), "Once, 25 November");
assert.equal(hhmm(new Date(2026, 10, 25, 8, 5).getTime()), "08:05", "the 24-hour clock");
assert.equal(hhmm(new Date(2026, 10, 25, 18, 30).getTime()), "18:30");
assert.match(longDate(now), /^\S+ 25 November$/, "the weekday, the day, then the month");

const days = agendaOf([daily], now, 3);
assert.equal(days.length, 1, "each automation once, at its next run");
assert.equal(new Date(days[0].items[0].at).getHours(), 9);
const hourly = agendaOf([one({ every_seconds: 6 * HOUR, next_run: at(0, 12) })], now, 3);
assert.deepEqual(hourly.map((d) => d.items.length), [1], "however often it runs");

const off = one({ enabled: false });
assert.equal(off.offReason, "Turned off by you");
assert.deepEqual(agendaOf([off], now, 2), [], "an automation that's off has no next runs");
const retired = one({ enabled: false, state: "cancelled", state_reason: "Its project was removed." });
assert.equal(retired.offReason, "Its project was removed.", "XO's own reason is shown as it says it");
assert.equal(one({ enabled: false, state: "cancelled", state_reason: "Saved turned off." }).offReason, "Turned off by you");
assert.equal(one({ enabled: false, state: "fired", every_seconds: null }).offReason, "Done: it ran once");

const agenda = agendaOf(automations([job(), job({ id: "j5", next_run: at(1, 9) }), job({ id: "j6", next_run: at(2, 9) })]), now, 3);
assert.deepEqual(agenda.map((day) => day.label), ["Today", "Tomorrow", agenda[2].label]);
assert.deepEqual(agenda.map((day) => day.items.map((item) => item.automation.id)), [["j1"], ["j5"], ["j6"]]);

const week = weekOf(list, now);
assert.equal(week.length, 7);
assert.equal(new Date(week[0].start).getDay(), 1, "the week starts on Monday");
assert.equal(week.filter((day) => day.today).length, 1);
assert.equal(week.find((day) => day.today)?.dots.length, 1);
assert.equal(week[0].dots.length, 1, "a past day it ran on keeps its dot");
assert.equal(weekOf(automations([job({ first_run_at: at(0, 9) })]), now)[0].dots.length, 0, "not before it started");

const failed = job({ id: "j2", last_result: { at: at(-1, 9), status: "failed", trigger: "schedule", reason: "No usage left" } });
const found = job({ id: "j3", last_result: { at: at(0, 7), status: "ok", trigger: "schedule", found: true, summary: "Two PRs",
  thread: { chat_id: "chat_a", ts: "171.5" } } });
const quiet = job({ id: "j4", last_result: { at: at(0, 6), status: "ok", trigger: "schedule", found: false, summary: null } });
assert.deepEqual(noticedOf(automations([failed, found, quiet])).map((a) => a.id), ["j3", "j2"],
  "found something or failed, newest first; a quiet run isn't listed");

const [seen] = automations([found]);
assert.deepEqual(seen.last?.thread, { chat: "chat_a", ts: "171.5" }, "the run's thread, as XO Space names it");
assert.equal(seen.last?.at, Date.parse(at(0, 7)));
assert.equal(automations([failed])[0].last?.reason, "No usage left");
assert.equal(seen.last?.summary, "Two PRs", "what the run found, in a line");
assert.equal(one({ enabled: false, disabled_by: { kind: "person", at: at(-5, 9) } }).offReason, "Turned off by you, 20 Nov");
assert.equal(one({ enabled: false, disabled_by: { kind: "xo", reason: "Its agent was deleted" } }).offReason, "Its agent was deleted");

const rows = runRowsOf([
  { fire_at: at(0, 7), trigger: "manual", status: "ok", reason: null, found: true, summary: "x", thread: { chat_id: "chat_a", ts: "1.2", state: "done" } },
  { fire_at: at(-1, 7), trigger: "schedule", status: "skipped", reason: "still running", found: null, summary: null, thread: null },
]);
assert.deepEqual(rows.map((r) => [r.key, r.status, r.manual, r.thread?.ts ?? null]),
  [[at(0, 7), "ok", true, "1.2"], [at(-1, 7), "skipped", false, null]], "an agent job's runs, keyed by when they fired");

const rule = (/** @type {Record<string, unknown>} */ schedule, over = {}) => one({ every_seconds: null, first_run_at: null, schedule, ...over });
assert.equal(cadenceWords(rule({ days: "weekdays", time: "09:00", tz: "UTC" })), "Weekdays");
assert.equal(cadenceWords(rule({ days: ["sat", "sun"], time: "10:00", tz: "UTC" })), "Weekends");
assert.equal(cadenceWords(rule({ days: ["fri", "mon", "wed"], time: "09:00", tz: "UTC" })), "Mon, Wed and Fri");
assert.equal(cadenceWords(rule({ days: ["tue"], time: "09:00", tz: "UTC" })), "Tuesdays");
assert.equal(cadenceWords(rule({ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], time: "09:00", tz: "UTC" })), "Every day");
assert.equal(cadenceWords(rule({ day_of_month: 1, time: "09:00", tz: "UTC" })), "Monthly, on the 1st");
assert.equal(cadenceWords(rule({ day_of_month: "last", time: "09:00", tz: "UTC" })), "Monthly, on the last day");

const weekdays = rule({ days: "weekdays", time: "09:00", tz: "UTC" }, { upcoming: [at(0, 9), at(1, 9), at(2, 9), at(5, 9)] });
assert.deepEqual(agendaOf([weekdays], now, 7).map((d) => new Date(d.start).getDate()), [25], "at its next run, as XO Space says");
assert.deepEqual(weekOf([weekdays], now).map((d) => d.dots.length), [1, 1, 1, 1, 1, 0, 0], "weekdays, past ones too, not the weekend");

console.log("model: ok");
