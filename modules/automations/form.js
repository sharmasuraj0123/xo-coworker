// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { DAY_MS, formatDate, startOfDay } from "../../core/platform/time.js";
import { titleOf } from "./agent-file.js";
import { cadenceOf, dayAt, ordinal } from "./model.js";
import { browserZone } from "./zone.js";

/** @import { AgentJobBody, ScheduleRule } from "../../core/platform/schedule-response-types" */

/** @import { Agent, Automation, Cadence, FormOptions, FormValues, Repeat } from "./types" */

const HOUR_S = 3600;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** "2026-11-27T09:00:00+05:30": the browser's own offset, as XO Space asks. @param {number} ms */
function isoLocal(ms) {
  const d = new Date(ms), pad = (/** @type {number} */ n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${off < 0 ? "-" : "+"}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** @param {number} n */
const two = (n) => String(n).padStart(2, "0");

/** @param {number} ms */
const timeOf = (ms) => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;

/** @param {number} ms */
const dateOf = (ms) => `${new Date(ms).getFullYear()}-${two(new Date(ms).getMonth() + 1)}-${two(new Date(ms).getDate())}`;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WORK_DAYS = [1, 2, 3, 4, 5];
const NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;

/** @param {Cadence} c @returns {Repeat} */
function repeatOf({ kind, days, step }) {
  if (kind === "days") return days.join() === WORK_DAYS.join() ? "weekdays" : "week";
  if (kind === "day" && step > 1) return "hours";
  return kind === "minute" || kind === "hour" ? "hours" : kind;
}

/** A new one's values: every day at 9, from tomorrow. @param {string} chat @param {number} at @returns {FormValues} */
const blankOf = (chat, at) => ({ name: "", prompt: "", chat, repeat: "day", time: "09:00", date: dateOf(at), days: [new Date(at).getDay()],
  dom: new Date(at).getDate(), hours: 6, persona: null });

/** A day on or off among the chosen ones; the last one stays on. @param {FormValues} v @param {number} d @returns {FormValues} */
export function withDay(v, d) {
  const days = v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d];
  return days.length ? { ...v, days } : v;
}

/** The automation's values, or a new one's. @param {Automation | null} a @param {string} chat @param {number} now @returns {FormValues} */
export function valuesOf(a, chat, now) {
  const fallback = startOfDay(new Date(now + DAY_MS)) + 9 * HOUR_S * 1000, blank = blankOf(chat, fallback);
  if (!a) return blank;
  const cadence = cadenceOf(a, now), { kind, at, step } = cadence;
  const when = Number.isFinite(at) ? at : fallback, repeat = repeatOf(cadence);
  return { ...blank, name: a.name, prompt: a.prompt, chat: a.project, repeat, time: a.rule?.time ?? timeOf(when), date: dateOf(when),
    days: repeat === "week" && cadence.days.length ? cadence.days : [new Date(when).getDay()], dom: cadence.dom ?? new Date(when).getDate(),
    hours: kind === "hour" ? step : kind === "day" && step > 1 ? step * 24 : 6, persona: a.persona };
}

/** When an interval starts, and how far apart its runs are. @param {FormValues} v @param {number} now */
function scheduleOf(v, now) {
  const [h, m] = v.time.split(":").map(Number);
  const minutes = ((h || 0) * 60 + (m || 0)) * 60_000;
  if (v.repeat === "once") {
    const [y, mo, d] = v.date.split("-").map(Number);
    return { every: null, first: new Date(y, (mo || 1) - 1, d || 1).getTime() + minutes };
  }
  return { every: Math.max(1, Math.round(v.hours)) * HOUR_S, first: startOfDay(new Date(now)) + minutes };
}

/** The calendar rule of a repeat that keeps its wall time. @param {FormValues} v @param {string} tz @returns {ScheduleRule | null} */
function ruleOf(v, tz) {
  if (v.repeat === "day") return { days: [1, 2, 3, 4, 5, 6, 0].map((d) => DAY_KEYS[d]), time: v.time, tz };
  if (v.repeat === "weekdays") return { days: "weekdays", time: v.time, tz };
  if (v.repeat === "week") return { days: [...v.days].sort((x, y) => (x || 7) - (y || 7)).map((d) => DAY_KEYS[d]), time: v.time, tz };
  if (v.repeat === "month") return { day_of_month: v.dom, time: v.time, tz };
  return null;
}

/** Why the form can't be saved yet, or "". @param {FormValues} v @param {number} now */
export function problemOf(v, now) {
  const name = v.name.trim();
  if (!name) return "Give it a name.";
  if (!NAME.test(name)) return "Name it with letters, numbers, spaces, dots, dashes or underscores, up to 64.";
  if (!v.prompt.trim()) return "Say what it should do each time.";
  if (!v.chat) return "Choose a project.";
  if (v.repeat === "once" && scheduleOf(v, now).first <= now) return "Choose a time that hasn't passed.";
  if (v.repeat === "week" && !v.days.length) return "Choose a day.";
  return "";
}

/** A copy's name, kept inside the name's length. @param {string} name */
export const copyName = (name) => `${name.slice(0, 59).trim()} copy`;

/** The job to send. @param {FormValues} v @param {Automation | null} a @param {number} now @returns {AgentJobBody} */
export function bodyOf(v, a, now, zone = browserZone) {
  const rule = ruleOf(v, a?.rule?.tz ?? zone()), { every, first } = scheduleOf(v, now);
  return {
    kind: "agent", name: v.name.trim(), description: a?.job.description ?? null, chat: v.chat,
    prompt: v.prompt.trim(), agent: a?.runtime ?? null, model: a?.model ?? null, effort: a?.effort ?? null,
    every_seconds: rule ? null : every, first_run_at: rule ? null : isoLocal(first), schedule: rule, enabled: a ? a.on : true,
    persona: v.persona, icon: a?.job.icon ?? null,
  };
}

/** @param {string} value @param {string} words @param {boolean} on */
const opt = (value, words, on) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(words)}</option>`;

const REPEATS = [["once", "Once"], ["day", "Every day"], ["weekdays", "Weekdays"], ["week", "On chosen days"],
  ["month", "Every month"], ["hours", "Every few hours"]];

/** @param {FormValues} v */
function whenHtml(v) {
  const repeat = REPEATS.map(([value, words]) => opt(value, words, v.repeat === value)).join("");
  const days = WEEKDAYS.map((d) => `<button type="button" aria-pressed="${v.days.includes(d)}" data-au-day="${d}"` +
    ` aria-label="${esc(formatDate(dayAt(d), "fullWeekday"))}">${esc(formatDate(dayAt(d), "weekday"))}</button>`).join("");
  const date = `<label class="field"><span>Date</span><input type="date" name="date" value="${esc(v.date)}"></label>`;
  const hours = `<label class="field"><span>Every</span><span class="au-hours">` +
    `<input type="number" name="hours" min="1" max="23" value="${v.hours}"> hours</span></label>`;
  const doms = [...Array.from({ length: 31 }, (_, i) => opt(String(i + 1), `The ${ordinal(i + 1)}`, v.dom === i + 1)),
    opt("last", "The last day", v.dom === "last")].join("");
  const dom = `<label class="field"><span>Day</span>` +
    `<xo-select name="dom" class="set-sel" aria-label="Day of the month">${doms}</xo-select></label>`;
  return `<div class="au-when"><label class="field"><span>Repeat</span>` +
    `<xo-select name="repeat" class="set-sel" aria-label="Repeat">${repeat}</xo-select></label>` +
    (v.repeat === "once" ? date : "") + (v.repeat === "hours" ? hours : "") + (v.repeat === "month" ? dom : "") +
    `<label class="field"><span>${v.repeat === "hours" ? "Starting at" : "Time"}</span>` +
    `<input type="time" name="time" value="${esc(v.time)}"></label></div>` +
    (v.repeat === "week" ? `<div class="au-days" role="group" aria-label="Days">${days}</div>` : "");
}

const AGENT_NOTE = "Changing what it does makes it yours: it no longer counts as what you allowed.";

/** The project's own agents, then the Space's, then none. @param {FormValues} v @param {Agent[] | null} agents */
function agentPickHtml(v, agents) {
  const on = v.persona ? `${v.persona.level}:${v.persona.name}` : "";
  const usable = (agents ?? []).filter((a) => !a.shadowed && !a.problems.length)
    .sort((x, y) => Number(x.level === "space") - Number(y.level === "space") || x.name.localeCompare(y.name));
  const opts = usable.map((a) => opt(`${a.level}:${a.name}`, `${titleOf(a.name)}${a.level === "space" ? " · Every project" : ""}`,
    on === `${a.level}:${a.name}`));
  if (v.persona && !usable.some((a) => `${a.level}:${a.name}` === on)) opts.unshift(opt(on, titleOf(v.persona.name), true));
  return `<label class="field"><span>Agent</span><xo-select name="persona" class="set-sel" aria-label="Agent">${opts.join("")}` +
    `${opt("", "No agent (just the runtime)", !on)}</xo-select></label>`;
}

/** @param {FormValues} v @param {Automation | null} a @param {FormOptions} o */
export function formHtml(v, a, { projects, problem, busy, agents }) {
  const chats = projects.map((p) => opt(p.chat, p.name, p.chat === v.chat)).join("");
  return `<form class="au-form" data-au-form novalidate>` +
    `<div class="au-form-bar"><button type="button" class="btn" data-au-act="cancel">Cancel</button>` +
    `<b>${a ? "Edit automation" : "New automation"}</b>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(busy)}>${a ? "Save" : "Turn on"}</button></div>` +
    `<label class="field"><span>Name</span>` +
    `<input name="name" value="${esc(v.name)}" placeholder="Morning check" autocomplete="off"></label>` +
    `<label class="field"><span>What to do each time</span><textarea name="prompt" rows="5"` +
    ` placeholder="Check what's live and tell me only if something looks wrong.">${esc(v.prompt)}</textarea></label>` +
    `<label class="field"><span>Project</span>` +
    `<xo-select name="chat" class="set-sel" aria-label="Project"${a ? " disabled" : ""}>${chats}</xo-select></label>` +
    agentPickHtml(v, agents) + whenHtml(v) +
    (a && a.askedBy === "agent" && a.approved ? `<p class="au-note">${AGENT_NOTE}</p>` : "") +
    (problem ? `<p class="au-problem" role="alert">${esc(problem)}</p>` : "") + `</form>`;
}

/** The form's values as typed. @param {ParentNode} form @param {FormValues} was @returns {FormValues} */
export function readForm(form, was) {
  /** @param {string} name @param {string} fallback */
  const text = (name, fallback) => {
    const el = form.querySelector(`[name="${name}"]`);
    return el && "value" in el && typeof el.value === "string" ? el.value : fallback;
  };
  const repeat = /** @type {Repeat} */ (text("repeat", was.repeat)), dom = text("dom", String(was.dom)), chat = text("chat", was.chat);
  const picked = text("persona", was.persona ? `${was.persona.level}:${was.persona.name}` : ""), at = picked.indexOf(":");
  const persona = at > 0 && !(chat !== was.chat && picked.startsWith("project:"))
    ? { level: picked.startsWith("space:") ? /** @type {const} */ ("space") : "project", name: picked.slice(at + 1) } : null;
  return { ...was, name: text("name", was.name), prompt: text("prompt", was.prompt), chat, persona, repeat,
    time: text("time", was.time) || was.time, date: text("date", was.date) || was.date,
    hours: Number(text("hours", String(was.hours))) || was.hours, dom: dom === "last" ? "last" : Number(dom) || was.dom };
}
