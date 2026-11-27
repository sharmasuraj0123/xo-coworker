// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { DAY_MS, formatDate, startOfDay } from "../../core/platform/time.js";
import { xi } from "../../core/ui/icons/icon.js";
import { titleOf } from "./agent-file.js";
import { cadenceOf, dayAt, ordinal } from "./model.js";
import { NOTIFY, ON_FAILURE, tile } from "./views.js";
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
const NAME_WORDS = 48;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** @param {Cadence} c @returns {Repeat} */
function repeatOf({ kind, days, step }) {
  if (kind === "days") return days.join() === WORK_DAYS.join() ? "weekdays" : "week";
  if (kind === "day" && step > 1) return "hours";
  return kind === "minute" || kind === "hour" ? "hours" : kind;
}

/** Today's date, or one n days on. @param {number} n */
const dayAhead = (n) => { const t = new Date(); return dateOf(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n).getTime()); };

/** A new one's values: every day at 9, from tomorrow. @param {string} chat @param {number} at @returns {FormValues} */
const blankOf = (chat, at) => ({ name: "", prompt: "", chat, repeat: "day", time: "09:00", date: dateOf(at), days: [new Date(at).getDay()],
  dom: new Date(at).getDate(), hours: 6, persona: null, notify: null, onFailure: null });

/** A day on or off; all seven make every day, Monday to Friday weekdays; the last one stays on. @param {FormValues} v @param {number} d */
export function withDay(v, d) {
  const was = v.repeat === "day" ? WEEKDAYS : v.repeat === "weekdays" ? WORK_DAYS : v.days;
  const days = was.includes(d) ? was.filter((x) => x !== d) : [...was, d];
  if (!days.length) return v;
  const work = days.length === WORK_DAYS.length && WORK_DAYS.every((x) => days.includes(x));
  return { ...v, days, repeat: /** @type {Repeat} */ (days.length === 7 ? "day" : work ? "weekdays" : "week") };
}

/** A name from what it does, as XO Space allows names: its first words. @param {string} prompt */
function nameFrom(prompt) {
  const words = (prompt.trim().split(/[.!?\n]/)[0] ?? "").replace(/['’]/g, "").replace(/[^A-Za-z0-9 _.-]+/g, " ")
    .replace(/\s+/g, " ").replace(/^[^A-Za-z0-9]+/, "").trim();
  const cut = words.length > NAME_WORDS ? words.slice(0, NAME_WORDS + 1).replace(/\s+\S*$/, "") : words;
  return cut ? cut[0].toUpperCase() + cut.slice(1) : "Automation";
}

/** "8:30" and "0830" read as "08:30". @param {string} typed */
function timeFrom(typed) {
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(typed.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : typed.trim();
}

/** The automation's values, or a new one's. @param {Automation | null} a @param {string} chat @param {number} now @returns {FormValues} */
export function valuesOf(a, chat, now) {
  const fallback = startOfDay(new Date(now + DAY_MS)) + 9 * HOUR_S * 1000, blank = blankOf(chat, fallback);
  if (!a) return blank;
  const cadence = cadenceOf(a, now), { kind, at, step } = cadence;
  const when = Number.isFinite(at) ? at : fallback, repeat = repeatOf(cadence);
  return { ...blank, name: a.name, prompt: a.prompt, chat: a.project, repeat, time: a.rule?.time ?? timeOf(when), date: dateOf(when),
    days: repeat === "week" && cadence.days.length ? cadence.days : [new Date(when).getDay()], dom: cadence.dom ?? new Date(when).getDate(),
    hours: kind === "hour" ? step : kind === "day" && step > 1 ? step * 24 : 6, persona: a.persona,
    notify: a.notify, onFailure: a.notify ? a.onFailure ?? "tell" : null };
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
  if (!v.prompt.trim()) return "Say what it should do each time.";
  const name = v.name.trim() || nameFrom(v.prompt);
  if (!NAME.test(name)) return "Name it with letters, numbers, spaces, dots, dashes or underscores, up to 64.";
  if (!TIME.test(v.time)) return "Write the time as 24-hour, like 08:30.";
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
    kind: "agent", name: v.name.trim() || nameFrom(v.prompt), description: a?.job.description ?? null, chat: v.chat,
    prompt: v.prompt.trim(), agent: a?.runtime ?? null, model: a?.model ?? null, effort: a?.effort ?? null,
    every_seconds: rule ? null : every, first_run_at: rule ? null : isoLocal(first), schedule: rule, enabled: a ? a.on : true,
    persona: v.persona, icon: a?.job.icon ?? null, ...(v.notify ? { notify: v.notify, on_failure: v.onFailure ?? "tell" } : {}),
  };
}

/** @param {string} value @param {string} words @param {boolean} on @param {string} [icon] */
const opt = (value, words, on, icon = "") =>
  `<option value="${esc(value)}"${on ? " selected" : ""}${icon ? ` data-icon="${icon}"` : ""}>${esc(words)}</option>`;

const REPEATS = [["once", "Once", "calendar"], ["day", "Every day", "repeat"], ["weekdays", "Every weekday", "calendar"],
  ["week", "Every week on…", "calendar"], ["month", "Every month on…", "calendar"], ["hours", "Every few hours…", "timer"]];
const LATER = `<option value="event" disabled data-icon="bolt-fill" data-desc="later">When something happens…</option>`;
const ON_DAYS = new Set(["day", "weekdays", "week"]);

/** @param {FormValues} v */
const repeatPick = (v) => `<xo-select name="repeat" class="au-chip" data-mark="check" aria-label="Repeat">` +
  `${REPEATS.map(([value, words, icon]) => opt(value, words, v.repeat === value, icon)).join("")}${LATER}</xo-select>`;

/** @param {FormValues} v @param {string} cls */
const timeIn = (v, cls) => `<input name="time" class="${cls}" value="${esc(v.time)}" inputmode="numeric" maxlength="5"` +
  ` autocomplete="off" placeholder="08:30" aria-label="${v.repeat === "hours" ? "Starting at" : "Time"}">`;

/** The days a day-based repeat runs on. @param {FormValues} v */
const daysOn = (v) => v.repeat === "day" ? WEEKDAYS : v.repeat === "weekdays" ? WORK_DAYS : v.days;

/** @param {FormValues} v */
function daysHtml(v) {
  const on = daysOn(v);
  return `<div class="au-days" role="group" aria-label="Days">${WEEKDAYS.map((d) => {
    const name = formatDate(dayAt(d), "fullWeekday");
    return `<button type="button" aria-pressed="${on.includes(d)}" data-au-day="${d}" aria-label="${esc(name)}">` +
      `${esc(name.slice(0, 1))}</button>`;
  }).join("")}</div>`;
}

/** What a repeat that isn't by days needs: its date, its day of the month or its hours. @param {FormValues} v */
function sinceHtml(v) {
  if (v.repeat === "once") {
    return `<xo-date name="date" class="au-chip" value="${esc(v.date)}" min="${dayAhead(0)}" aria-label="Date"></xo-date>`;
  }
  if (v.repeat === "hours") return `<input name="hours" class="au-chip-in" inputmode="numeric" maxlength="2" value="${v.hours}"` +
    ` aria-label="Hours apart"><span>hours, from</span>`;
  if (v.repeat !== "month") return "";
  const doms = [...Array.from({ length: 31 }, (_, i) => opt(String(i + 1), `the ${ordinal(i + 1)}`, v.dom === i + 1)),
    opt("last", "the last day", v.dom === "last")].join("");
  return `<xo-select name="dom" class="au-chip" data-mark="check" aria-label="Day of the month">${doms}</xo-select>`;
}

const AGENT_NOTE = "Changing what it does makes it yours: it no longer counts as what you allowed.";

/** The project's own agents, then the Space's, then none. @param {FormValues} v @param {Agent[] | null} agents @param {string} none */
function agentPick(v, agents, none) {
  const on = v.persona ? `${v.persona.level}:${v.persona.name}` : "";
  const usable = (agents ?? []).filter((a) => !a.shadowed && !a.problems.length)
    .sort((x, y) => Number(x.level === "space") - Number(y.level === "space") || x.name.localeCompare(y.name));
  const opts = usable.map((a) => opt(`${a.level}:${a.name}`, `${titleOf(a.name)}${a.level === "space" ? " · Every project" : ""}`,
    on === `${a.level}:${a.name}`));
  if (v.persona && !usable.some((a) => `${a.level}:${a.name}` === on)) opts.unshift(opt(on, titleOf(v.persona.name), true));
  return `<xo-select name="persona" class="au-chip" data-mark="check" aria-label="Agent">${opts.join("")}${opt("", none, !on)}</xo-select>`;
}

/** When it tells you and what a failure does, as two choices; nothing where XO Space doesn't keep them. @param {FormValues} v */
function tellPicks(v, inRow = true) {
  if (!v.notify) return ["", ""];
  const w = inRow ? 1 : 2;
  const pick = (/** @type {string} */ name, /** @type {string} */ label, /** @type {string[][]} */ list, /** @type {string | null} */ on) =>
    `<xo-select name="${name}" class="au-chip" data-mark="check" aria-label="${label}">` +
    `${list.map((o) => opt(o[0], o[w], o[0] === on)).join("")}</xo-select>`;
  return [pick("notify", "Tells you", NOTIFY, v.notify), pick("on_failure", "If it fails", ON_FAILURE, v.onFailure)];
}

/** @param {string} problem */
const problemHtml = (problem) => problem ? `<p class="au-problem" role="alert">${esc(problem)}</p>` : "";

/** @param {FormValues} v */
const tells = (v) => {
  const [notify, fail] = tellPicks(v);
  return notify ? `<li>${xi("bell")}<span>Tells you</span>${notify}</li><li>${xi("alert")}<span>If it fails</span>${fail}</li>` : "";
};

/** @param {FormValues} v */
const sayTells = (v) => {
  const [notify, fail] = tellPicks(v, false);
  return notify ? `<div class="au-tell">${xi("bell")}<span>Tell me</span>${notify}</div>` +
    `<div class="au-tell">${xi("alert")}<span>If a run fails,</span>${fail}</div>` : "";
};

/** Editing one in its panel. @param {FormValues} v @param {Automation} a @param {FormOptions} o @param {string} projectName */
export function formHtml(v, a, { problem, busy, agents }, projectName) {
  const repeat = `<div class="field"><span class="au-field-hd"><span>Repeat</span>${repeatPick(v)}</span>` +
    (ON_DAYS.has(v.repeat) ? daysHtml(v) : `<span class="au-say">${sinceHtml(v)}</span>`) + `</div>`;
  return `<form class="au-form au-view" data-key="edit:${esc(a.id)}" data-au-form novalidate aria-label="Edit ${esc(a.name)}">` +
    `<div class="au-bar"><button type="button" class="au-back" data-au-act="cancel">Cancel</button>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(busy)}>Save</button></div>` +
    `<div class="au-hd">${tile(a.icon)}` +
    `<input name="name" class="au-name" value="${esc(v.name)}" aria-label="Name" autocomplete="off"></div>` +
    `<label class="field"><span>${v.repeat === "hours" ? "Starting at" : "Time"}</span>${timeIn(v, "au-time-in")}</label>` + repeat +
    `<label class="field"><span>Each time</span><textarea name="prompt" rows="4">${esc(v.prompt)}</textarea></label>` +
    `<ul class="au-kv"><li>${xi("agent")}<span>Agent</span>${agentPick(v, agents, "None, just the runtime")}</li>` +
    `<li>${xi("project")}<span>Project</span><b>${esc(projectName)}</b></li>${tells(v)}</ul>` +
    (a.askedBy === "agent" && a.approved ? `<p class="au-note">${AGENT_NOTE}</p>` : "") + problemHtml(problem) + `</form>`;
}

/** A new one, as one sentence: when, which agent, where, and what it will do. @param {FormValues} v @param {FormOptions} o */
export function sentenceHtml(v, { projects, problem, busy, agents }) {
  const chats = projects.map((p) => opt(p.chat, p.name, p.chat === v.chat)).join("");
  const near = v.repeat === "once" && [0, 1].some((n) => dayAhead(n) === v.date);
  const at = near || v.repeat === "hours" ? "" : v.repeat === "once" || v.repeat === "month" ? "<span>on</span>" : "";
  return `<form class="au-form au-new" data-au-form novalidate aria-labelledby="au-new-h">` +
    `<div class="au-bar"><button type="button" class="au-back" data-au-act="cancel">Cancel</button><b id="au-new-h">New automation</b>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(busy)}>Create</button></div>` +
    `<div class="au-say">${repeatPick(v)}${at}${sinceHtml(v)}${v.repeat === "hours" ? "" : "<span>at</span>"}` +
    `${timeIn(v, "au-chip-in")}</div>` +
    (v.repeat === "week" ? daysHtml(v) : "") +
    `<div class="au-say">${agentPick(v, agents, "An agent")}<span>in</span>` +
    `<xo-select name="chat" class="au-chip" data-mark="check" aria-label="Project">${chats}</xo-select><span>will</span></div>` +
    `<textarea name="prompt" class="au-say-text" rows="4" aria-label="What it does each time"` +
    ` placeholder="check what's live and tell me only if something looks wrong.">${esc(v.prompt)}</textarea>` +
    sayTells(v) + problemHtml(problem) + `<p class="au-note">You can also ask any coordinator for one in your own words.</p></form>`;
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
  const told = text("notify", was.notify ?? ""), notify = !was.notify ? null : told === "always" || told === "never" ? told : "found";
  const onFailure = !was.notify ? null : text("on_failure", was.onFailure ?? "") === "silent" ? "silent" : "tell";
  return { ...was, name: text("name", was.name), prompt: text("prompt", was.prompt), chat, persona, repeat, notify, onFailure,
    time: timeFrom(text("time", was.time)) || was.time, date: text("date", was.date) || was.date,
    hours: Number(text("hours", String(was.hours))) || was.hours, dom: dom === "last" ? "last" : Number(dom) || was.dom };
}
