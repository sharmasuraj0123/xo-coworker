// @ts-check

import assert from "node:assert/strict";
import { agendaOf, automationsOf, cadenceWords, noticedOf, weekOf } from "../model.js";

const HOUR = 3600, DAY = 86400;
const now = new Date(2026, 10, 25, 8, 0).getTime();
const at = (/** @type {number} */ days, /** @type {number} */ hour, minute = 0) => new Date(2026, 10, 25 + days, hour, minute).toISOString();

/** @param {Record<string, unknown>} over */
const job = (over = {}) => ({
  id: "j1", name: "Morning check", kind: "agent", chat: "chat_a", prompt: "Look", utc_offset: "+00:00", agent: null, model: null,
  effort: null, description: null, enabled: true, running: false, every_seconds: DAY, first_run_at: at(-3, 9), next_run: at(0, 9),
  last_run: null, running_since: null, last_result: null, ...over,
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
assert.match(cadenceWords(daily), /^Every day at 9:00/);
assert.match(cadenceWords(one({ every_seconds: 7 * DAY })), /^Every Wednesday at 9:00/);
assert.equal(cadenceWords(one({ every_seconds: 6 * HOUR })), "Every 6 hours");
assert.match(cadenceWords(one({ every_seconds: null })), /^Once, Nov 25 at 9:00/);

const days = agendaOf([daily], now, 3);
assert.equal(days.length, 3, "a daily run, three days");
assert.equal(new Date(days[0].items[0].at).getHours(), 9);
const hourly = agendaOf([one({ every_seconds: 6 * HOUR })], now, 1);
assert.equal(hourly[0].items.length, 1, "each automation once a day in the agenda, however often it runs");

const off = one({ enabled: false });
assert.equal(off.offReason, "Turned off by you");
assert.deepEqual(agendaOf([off], now, 2), [], "an automation that's off has no next runs");
const retired = one({ enabled: false, disabled_by: { kind: "xo", reason: "Its project was removed." } });
assert.equal(retired.offReason, "Its project was removed.", "XO's own reason is shown as it says it");

const agenda = agendaOf(list, now, 3);
assert.deepEqual(agenda.map((day) => day.label), ["Today", "Tomorrow", agenda[2].label]);
assert.equal(agenda[0].items[0].automation.id, "j1");

const week = weekOf(list, now);
assert.equal(week.length, 7);
assert.equal(new Date(week[0].start).getDay(), 1, "the week starts on Monday");
assert.equal(week.filter((day) => day.today).length, 1);
assert.equal(week.find((day) => day.today)?.dots.length, 1);
assert.equal(week[0].dots.length, 0, "a past day has no dots");

const failed = job({ id: "j2", last_result: { started_at: at(-1, 9), finished_at: at(-1, 9, 5), status: "failed", trigger: "schedule" } });
const found = job({ id: "j3", last_result: { started_at: at(0, 7), finished_at: at(0, 7, 5), status: "ok", trigger: "schedule", found: true } });
const quiet = job({ id: "j4", last_result: { started_at: at(0, 6), finished_at: at(0, 6, 5), status: "ok", trigger: "schedule" } });
assert.deepEqual(noticedOf(automations([failed, found, quiet])).map((a) => a.id), ["j3", "j2"],
  "found something or failed, newest first; a quiet run isn't listed");
