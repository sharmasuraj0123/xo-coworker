// @ts-check

import assert from "node:assert/strict";
import { bodyOf, copyName, problemOf, valuesOf } from "../form.js";
import { automationsOf } from "../model.js";
import { job } from "./fakes.mjs";

const now = new Date(2026, 10, 25, 8, 0).getTime();
const [a] = automationsOf(/** @type {never} */ ([job({ approved_by: { review_id: "rv1" }, created_by: { kind: "agent" } })]));
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:00[+-]\d\d:\d\d$/;

const fresh = { ...valuesOf(null, "chat_a", now), name: " Weekly ", prompt: "Sum up " };
assert.equal(problemOf({ ...fresh, name: "" }, now), "Give it a name.");
assert.equal(problemOf({ ...fresh, prompt: " " }, now), "Say what it should do each time.");
assert.equal(problemOf({ ...fresh, chat: "" }, now), "Choose a project.");
assert.equal(problemOf({ ...fresh, repeat: "once", date: "2026-11-24", time: "09:00" }, now), "Choose a time that hasn't passed.");
assert.equal(problemOf(fresh, now), "");

const zone = () => "Europe/London";
const weekly = bodyOf({ ...fresh, repeat: "week", days: [5, 1], time: "07:30" }, null, now, zone);
assert.equal(weekly.name, "Weekly");
assert.equal(weekly.prompt, "Sum up");
assert.deepEqual(weekly.schedule, { days: ["mon", "fri"], time: "07:30", tz: "Europe/London" }, "the chosen days, in the browser's zone");
assert.deepEqual([weekly.every_seconds, weekly.first_run_at], [null, null], "a calendar rule says when it runs by itself");
assert.equal(weekly.enabled, true, "a new one is on");
assert.equal(weekly.agent, null, "a new one runs on the project's default");
assert.deepEqual(bodyOf({ ...fresh, repeat: "weekdays" }, null, now, zone).schedule, { days: "weekdays", time: "09:00", tz: "Europe/London" });
assert.deepEqual(bodyOf({ ...fresh, repeat: "month", dom: "last" }, null, now, zone).schedule,
  { day_of_month: "last", time: "09:00", tz: "Europe/London" });
assert.equal(bodyOf({ ...fresh, repeat: "day" }, null, now, zone).schedule?.days?.length, 7);

const hourly = bodyOf({ ...fresh, repeat: "hours", hours: 6 }, null, now, zone);
assert.deepEqual([hourly.every_seconds, hourly.schedule], [6 * 3600, null], "an interval clears any rule it had");
assert.match(hourly.first_run_at ?? "", ISO, "the browser's own offset, as XO Space asks");
const once = bodyOf({ ...fresh, repeat: "once", date: "2026-11-30", time: "10:00" }, null, now, zone);
assert.equal(once.every_seconds, null);
assert.equal(new Date(once.first_run_at ?? "").getDate(), 30);

assert.equal(problemOf({ ...fresh, name: "Morning: what changed" }, now), "Name it with letters, numbers, spaces, dots, dashes or underscores, up to 64.",
  "XO Space refuses a colon in a name");
assert.equal(problemOf({ ...fresh, name: copyName("x".repeat(64)) }, now), "", "a copy's name still fits");

const edited = bodyOf({ ...valuesOf(a, a.project, now), name: "Renamed" }, a, now);
assert.equal(edited.name, "Renamed");
assert.deepEqual([edited.agent, edited.model, edited.effort, edited.description], ["claude", "opus", "high", "Checks"], "edits keep what the form doesn't show");
assert.equal(edited.every_seconds, null, "a daily interval saves as a daily rule, which keeps its wall time");
assert.equal(edited.schedule?.days?.length, 7);
assert.equal(valuesOf(a, a.project, now).repeat, "day");

const [ruled] = automationsOf(/** @type {never} */ ([job({ every_seconds: null, first_run_at: null, persona: { name: "triage", level: "space" },
  schedule: { days: ["mon", "thu"], time: "18:15", tz: "Asia/Kolkata" } })]));
const back = valuesOf(ruled, ruled.project, now);
assert.deepEqual([back.repeat, back.days, back.time, back.persona?.name], ["week", [1, 4], "18:15", "triage"]);
assert.equal(bodyOf(back, ruled, now, zone).schedule?.tz, "Asia/Kolkata", "an edit keeps the rule's own zone");

console.log("form: ok");
