// @ts-check

import assert from "node:assert/strict";
import { bodyOf, problemOf, valuesOf } from "../form.js";
import { automationsOf } from "../model.js";
import { job } from "./fakes.mjs";

const now = new Date(2026, 10, 25, 8, 0).getTime();
const [a] = automationsOf(/** @type {never} */ ([job({ approved_by: { kind: "person" }, created_by: { kind: "agent" } })]));
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:00[+-]\d\d:\d\d$/;

const fresh = { ...valuesOf(null, "chat_a", now), name: " Weekly ", prompt: "Sum up " };
assert.equal(problemOf({ ...fresh, name: "" }, now), "Give it a name.");
assert.equal(problemOf({ ...fresh, prompt: " " }, now), "Say what it should do each time.");
assert.equal(problemOf({ ...fresh, chat: "" }, now), "Choose a project.");
assert.equal(problemOf({ ...fresh, repeat: "once", date: "2026-11-24", time: "09:00" }, now), "Choose a time that hasn't passed.");
assert.equal(problemOf(fresh, now), "");

const weekly = bodyOf({ ...fresh, repeat: "week", weekday: 1, time: "07:30" }, null, now);
assert.equal(weekly.name, "Weekly");
assert.equal(weekly.prompt, "Sum up");
assert.equal(weekly.every_seconds, 7 * 86400);
assert.match(weekly.first_run_at ?? "", ISO, "the browser's own offset, as XO Space asks");
const first = new Date(weekly.first_run_at ?? "");
assert.equal(first.getDay(), 1, "the next Monday");
assert.equal(`${first.getHours()}:${first.getMinutes()}`, "7:30");
assert.equal(weekly.enabled, true, "a new one is on");
assert.equal(weekly.agent, null, "a new one runs on the project's default");

assert.equal(bodyOf({ ...fresh, repeat: "hours", hours: 6 }, null, now).every_seconds, 6 * 3600);
assert.equal(bodyOf({ ...fresh, repeat: "once", date: "2026-11-30", time: "10:00" }, null, now).every_seconds, null);

const edited = bodyOf({ ...valuesOf(a, a.project, now), name: "Renamed" }, a, now);
assert.equal(edited.name, "Renamed");
assert.deepEqual([edited.agent, edited.model, edited.effort, edited.description], ["claude", "opus", "high", "Checks"], "edits keep what the form doesn't show");
assert.equal(edited.every_seconds, 86400);
assert.equal(valuesOf(a, a.project, now).repeat, "day");

console.log("form: ok");
