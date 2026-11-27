// @ts-check

import assert from "node:assert/strict";
import { bodyOf, copyName, formHtml, problemOf, readForm, sentenceHtml, valuesOf, withDay } from "../form.js";
import { automationsOf } from "../model.js";
import { job, persona } from "./fakes.mjs";

const now = new Date(2026, 10, 25, 8, 0).getTime();
const [a] = automationsOf(/** @type {never} */ ([job({ approved_by: { review_id: "rv1" }, created_by: { kind: "agent" } })]));
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:00[+-]\d\d:\d\d$/;

const fresh = { ...valuesOf(null, "chat_a", now), name: " Weekly ", prompt: "Sum up " };
assert.equal(problemOf({ ...fresh, name: "" }, now), "", "a new one without a name takes it from what it does");
assert.equal(bodyOf({ ...fresh, name: "", prompt: "compare what's live on :3000 with coworker/modular, and say. Then stop." }, null, now).name,
  "Compare whats live on 3000 with coworker modular", "its first words, as XO Space allows a name, cut at a word");
assert.equal(bodyOf({ ...fresh, name: "", prompt: "... ?" }, null, now).name, "Automation");
assert.equal(problemOf({ ...fresh, time: "8.30pm" }, now), "Write the time as 24-hour, like 08:30.");
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

const agents = /** @type {never[]} */ ([persona({ name: "helper", level: "space" }), persona(),
  persona({ name: "release-checker", level: "space", shadowed: { name: "release-checker", level: "project" } }),
  persona({ name: "broken", problems: [{ line: 1, key: null, message: "No name." }] })]);
const runtimes = ["claude_code", "codex"];
const alpha = { projects: [{ chat: "chat_a", name: "Alpha", id: "alpha" }], problem: "", busy: "x", agents, runtimes, models: null };
const picker = formHtml(back, ruled, alpha, "Alpha").match(/<xo-select name="persona"[^>]*>(.*?)<\/xo-select>/)?.[1] ?? "";
assert.deepEqual([...picker.matchAll(/value="([^"]*)"/g)].map((m) => m[1]),
  ["space:triage", "project:release-checker", "space:helper", "rt:claude_code", "rt:codex"],
  "the project's own first, then the Space's, then each runtime; replaced and broken ones aren't offered; a chosen one not listed stays on top");
assert.match(picker, /<option data-agm="openai" value="rt:codex">Codex<\/option>/, "a runtime shows its mark");

const bare = { ...back, persona: null, runtime: "codex", model: null, effort: "high" };
const models = /** @type {never[]} */ ([{ id: "gpt-6.1-terra", name: "GPT-6.1 Terra", family_default: true, is_default: false }]);
const bareSaid = sentenceHtml(bare, { ...alpha, models });
assert.match(bareSaid, /<option data-agm="openai" value="rt:codex" selected>Codex<\/option><\/xo-select><span>with<\/span><xo-select name="model"/,
  "with no agent, the runtime is who runs it, then its model");
assert.match(bareSaid, /<option value="" selected>Default model<\/option><option value="gpt-6.1-terra">GPT-6.1 Terra<\/option>/);
assert.match(bareSaid, /<option value="high" selected>Deep thinking<\/option>/, "and how hard it thinks");
assert.doesNotMatch(bareSaid, /An agent|None, just the runtime/);
assert.match(sentenceHtml(bare, alpha), /<xo-select name="model"[^>]*aria-busy="true"/, "the models wait in their menu while they come");
assert.doesNotMatch(sentenceHtml(back, { ...alpha, models }), /name="model"|name="effort"/, "an agent says its own model");
const bareEdit = formHtml(bare, ruled, { ...alpha, models }, "Alpha");
assert.match(bareEdit, /<span>Model<\/span><xo-select name="model"[^>]*>.*<span>Thinking<\/span><xo-select name="effort"[^>]*><option value="">Default/,
  "Edit offers the same, a row each");
assert.equal(sentenceHtml({ ...bare, runtime: null }, alpha).includes('<option value="" selected>Default runtime</option>'), true,
  "one saved without a runtime says it runs on the default");
const sent = bodyOf(bare, ruled, now, zone);
assert.deepEqual([sent.agent, sent.model, sent.effort, sent.persona], ["codex", null, "high", null], "what is chosen is what is saved");
assert.deepEqual([bodyOf(back, ruled, now, zone).agent], [ruled.runtime], "an agent's automation keeps what it had");

/** @param {Record<string, string>} fields */
const typedForm = (fields) => {
  const querySelector = (sel = "") => {
    const name = /name="([^"]+)"/.exec(sel)?.[1] ?? "";
    return name in fields ? { value: fields[name] } : null;
  };
  return /** @type {never} */ ({ querySelector });
};
const mine = { ...back, chat: "chat_a" };
assert.deepEqual(readForm(typedForm({ persona: "project:release-checker" }), mine).persona, { level: "project", name: "release-checker" });
const onCodex = readForm(typedForm({ persona: "rt:codex", model: "opus" }), { ...mine, persona: null, runtime: "claude_code", model: "opus" });
assert.deepEqual([onCodex.persona, onCodex.runtime, onCodex.model], [null, "codex", null], "a runtime instead of an agent; its model starts over");
const kept2 = readForm(typedForm({ persona: "rt:codex", model: "gpt-6.1-terra", effort: "max" }), { ...mine, persona: null, runtime: "codex" });
assert.deepEqual([kept2.model, kept2.effort], ["gpt-6.1-terra", "max"]);
assert.equal(readForm(typedForm({ persona: "project:release-checker", chat: "chat_b" }), mine).persona, null,
  "a project's own agent doesn't follow the automation to another project");
assert.deepEqual(readForm(typedForm({ persona: "space:helper", chat: "chat_b" }), mine).persona, { level: "space", name: "helper" });
assert.deepEqual(bodyOf({ ...mine, persona: { level: "space", name: "helper" } }, null, now, zone).persona, { level: "space", name: "helper" });

assert.equal(readForm(typedForm({ time: "8:05" }), mine).time, "08:05", "a time typed short reads as 24-hour");

const weekdays = withDay(withDay({ ...fresh, repeat: "day" }, 0), 6);
assert.equal(weekdays.repeat, "weekdays", "Every day without Saturday and Sunday is weekdays");
assert.deepEqual([withDay(weekdays, 3).repeat, withDay(weekdays, 3).days], ["week", [1, 2, 4, 5]], "one more off makes chosen days");
assert.equal(withDay({ ...fresh, repeat: "week", days: [2] }, 2).days.length, 1, "the last day stays on");

const said = sentenceHtml({ ...fresh, repeat: "weekdays", time: "08:30" }, { projects: [{ chat: "chat_a", name: "Alpha", id: "alpha" }],
  problem: "", busy: "x", agents, runtimes: [], models: null });
assert.match(said, /data-icon="calendar">Every weekday<\/option>/, "the cadence menu has its icons");
assert.match(said, /<option value="event" disabled[^>]*data-desc="later">When something happens…/, "what can't be chosen yet says so");
assert.match(said, /<span>at<\/span><input name="time"[^>]*value="08:30"/);
assert.match(said, /<span>in<\/span><xo-select name="chat"[^>]*>.*Alpha.*<span>will<\/span>/);

assert.equal("notify" in bodyOf(fresh, null, now, zone), false, "an XO Space without notify gets no key it would refuse");
assert.equal(said.includes('name="notify"'), false, "nor a choice it can't keep");
const told = { ...fresh, notify: /** @type {const} */ ("found"), onFailure: /** @type {const} */ ("tell") };
const toldBody = bodyOf(told, null, now, zone);
assert.deepEqual([toldBody.notify, toldBody.on_failure], ["found", "tell"], "both, every time, so a save doesn't reset them");
const read = readForm(typedForm({ notify: "never", on_failure: "silent" }), told);
assert.deepEqual([read.notify, read.onFailure], ["never", "silent"]);
assert.equal(readForm(typedForm({ notify: "never" }), fresh).notify, null, "read only where XO Space keeps it");
const toldSaid = sentenceHtml(told, { projects: [{ chat: "chat_a", name: "Alpha", id: "alpha" }], problem: "", busy: "x", agents, runtimes: [], models: null });
assert.match(toldSaid, /<span>Tell me<\/span><xo-select name="notify"[^>]*><option value="found" selected[^>]*>only when it finds something/);
assert.match(toldSaid, /<span>If a run fails,<\/span><xo-select name="on_failure"[^>]*><option value="tell" selected[^>]*>tell me/);
const [kept] = automationsOf(/** @type {never} */ ([job({ notify: "always", on_failure: "silent" })]));
assert.deepEqual([valuesOf(kept, "", now).notify, valuesOf(kept, "", now).onFailure], ["always", "silent"], "Edit starts from what it has");
assert.match(formHtml(valuesOf(kept, "", now), kept, { projects: [], problem: "", busy: "x", agents, runtimes: [], models: null }, "Alpha"),
  /<span>Tells you<\/span><xo-select name="notify"[^>]*>.*value="always" selected[^>]*>After every run/);

assert.match(formHtml(back, ruled, { projects: [], problem: "", busy: "x", agents, runtimes: [], models: null }, "Alpha"), /<form class="au-form au-view" data-key="edit:/,
  "Edit is its own view, so it arrives like one");

console.log("form: ok");

const onceSaid = sentenceHtml({ ...fresh, repeat: "once", date: "2026-11-28" }, { projects: [], problem: "", busy: "x", agents: [], runtimes: [], models: null });
assert.match(onceSaid, /<xo-date name="date" class="au-chip" value="2026-11-28" min="\d{4}-\d\d-\d\d" aria-label="Date">/,
  "a date is chosen in the app's own calendar, from today on");
assert.doesNotMatch(onceSaid, /type="date"/, "never the browser's own");
const today = new Date();
/** @param {Date} d */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const onDay = (date = "") => sentenceHtml({ ...fresh, repeat: "once", date }, { projects: [], problem: "", busy: "x", agents: [], runtimes: [], models: null });
assert.doesNotMatch(onDay(iso(today)), /<span>on<\/span>/, "Once today at 09:00");
assert.doesNotMatch(onDay(iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))), /<span>on<\/span>/, "Once tomorrow");
assert.match(onDay("2031-03-10"), /<span>on<\/span><xo-date/, "Once on Mon 10 March");
const chips = [...sentenceHtml(fresh, { projects: [], problem: "", busy: "x", agents: [], runtimes: [], models: null }).matchAll(/<xo-select [^>]*class="au-chip"[^>]*>/g)];
assert.ok(chips.length > 2 && chips.every(([c]) => c.includes('data-mark="check"')), "a sentence's chips tick their choice at the end");
