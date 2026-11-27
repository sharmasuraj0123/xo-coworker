// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { DAY_MS, formatDate, startOfDay } from "../../core/platform/time.js";
import { cadenceOf, dayAt } from "./model.js";

/** @import { AgentJobBody } from "../../core/platform/schedule-response-types" */

/** @import { Automation, FormValues, Project, Repeat } from "./types" */

const HOUR_S = 3600, DAY_S = 86400;
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

/** The automation's values, or a new one's. @param {Automation | null} a @param {string} chat @param {number} now @returns {FormValues} */
export function valuesOf(a, chat, now) {
  const fallback = startOfDay(new Date(now + DAY_MS)) + 9 * HOUR_S * 1000;
  const weekday = new Date(fallback).getDay();
  if (!a) return { name: "", prompt: "", chat, repeat: "day", time: "09:00", date: dateOf(fallback), weekday, hours: 6 };
  const { kind, at, step } = cadenceOf(a);
  const when = Number.isFinite(at) ? at : fallback;
  const repeat = kind === "once" ? "once" : kind === "week" ? "week" : kind === "day" ? "day" : "hours";
  return { name: a.name, prompt: a.prompt, chat: a.project, repeat, time: timeOf(when), date: dateOf(when),
    weekday: new Date(when).getDay(), hours: kind === "hour" ? step : kind === "day" ? step * 24 : 6 };
}

/** When the grid starts, and how far apart its runs are. @param {FormValues} v @param {number} now */
function scheduleOf(v, now) {
  const [h, m] = v.time.split(":").map(Number);
  const minutes = ((h || 0) * 60 + (m || 0)) * 60_000;
  if (v.repeat === "once") {
    const [y, mo, d] = v.date.split("-").map(Number);
    return { every: null, first: new Date(y, (mo || 1) - 1, d || 1).getTime() + minutes };
  }
  const today = startOfDay(new Date(now)) + minutes;
  if (v.repeat === "week") {
    const ahead = (v.weekday - new Date(now).getDay() + 7) % 7;
    return { every: 7 * DAY_S, first: startOfDay(new Date(today + ahead * DAY_MS + DAY_MS / 2)) + minutes };
  }
  return { every: v.repeat === "day" ? DAY_S : Math.max(1, Math.round(v.hours)) * HOUR_S, first: today };
}

/** Why the form can't be saved yet, or "". @param {FormValues} v @param {number} now */
export function problemOf(v, now) {
  if (!v.name.trim()) return "Give it a name.";
  if (!v.prompt.trim()) return "Say what it should do each time.";
  if (!v.chat) return "Choose a project.";
  if (v.repeat === "once" && scheduleOf(v, now).first <= now) return "Choose a time that hasn't passed.";
  return "";
}

/** The job to send. @param {FormValues} v @param {Automation | null} a @param {number} now @returns {AgentJobBody} */
export function bodyOf(v, a, now) {
  const { every, first } = scheduleOf(v, now);
  return {
    kind: "agent", name: v.name.trim(), description: a?.job.description ?? null, chat: v.chat,
    prompt: v.prompt.trim(), agent: a?.runtime ?? null, model: a?.model ?? null, effort: a?.effort ?? null,
    every_seconds: every, first_run_at: isoLocal(first), enabled: a ? a.on : true,
  };
}

/** @param {string} value @param {string} words @param {boolean} on */
const opt = (value, words, on) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(words)}</option>`;

const REPEATS = [["once", "Once"], ["day", "Every day"], ["week", "Every week"], ["hours", "Every few hours"]];

/** @param {FormValues} v */
function whenHtml(v) {
  const repeat = REPEATS.map(([value, words]) => opt(value, words, v.repeat === value)).join("");
  const days = WEEKDAYS.map((d) => `<button type="button" role="radio" aria-checked="${v.weekday === d}" data-au-day="${d}"` +
    ` aria-label="${esc(formatDate(dayAt(d), "fullWeekday"))}">${esc(formatDate(dayAt(d), "weekday"))}</button>`).join("");
  const date = `<label class="field"><span>Date</span><input type="date" name="date" value="${esc(v.date)}"></label>`;
  const hours = `<label class="field"><span>Every</span><span class="au-hours">` +
    `<input type="number" name="hours" min="1" max="23" value="${v.hours}"> hours</span></label>`;
  return `<div class="au-when"><label class="field"><span>Repeat</span>` +
    `<xo-select name="repeat" class="set-sel" aria-label="Repeat">${repeat}</xo-select></label>` +
    (v.repeat === "once" ? date : "") + (v.repeat === "hours" ? hours : "") +
    `<label class="field"><span>${v.repeat === "hours" ? "Starting at" : "Time"}</span>` +
    `<input type="time" name="time" value="${esc(v.time)}"></label></div>` +
    (v.repeat === "week" ? `<div class="au-days" role="radiogroup" aria-label="Day">${days}</div>` : "");
}

const AGENT_NOTE = "Changing what it does makes it yours: it no longer counts as what you allowed.";

/** @param {FormValues} v @param {Automation | null} a @param {{ projects: Project[], problem: string, busy: string }} o */
export function formHtml(v, a, { projects, problem, busy }) {
  const chats = projects.map((p) => opt(p.chat, p.name, p.chat === v.chat)).join("");
  return `<form class="au-form" data-au-form novalidate>` +
    `<div class="au-form-bar"><button type="button" class="btn" data-au-act="cancel">Cancel</button>` +
    `<b>${a ? "Edit automation" : "New automation"}</b>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(busy)}>${a ? "Save" : "Turn on"}</button></div>` +
    `<label class="field"><span>Name</span>` +
    `<input name="name" value="${esc(v.name)}" placeholder="Morning: what changed" autocomplete="off"></label>` +
    `<label class="field"><span>What to do each time</span><textarea name="prompt" rows="5"` +
    ` placeholder="Check what's live and tell me only if something looks wrong.">${esc(v.prompt)}</textarea></label>` +
    `<label class="field"><span>Project</span>` +
    `<xo-select name="chat" class="set-sel" aria-label="Project"${a ? " disabled" : ""}>${chats}</xo-select></label>` +
    whenHtml(v) +
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
  const repeat = /** @type {Repeat} */ (text("repeat", was.repeat));
  return { ...was, name: text("name", was.name), prompt: text("prompt", was.prompt), chat: text("chat", was.chat), repeat,
    time: text("time", was.time) || was.time, date: text("date", was.date) || was.date,
    hours: Number(text("hours", String(was.hours))) || was.hours };
}
