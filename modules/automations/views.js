// @ts-check

import { esc } from "../../core/platform/util.js";
import { clock, formatDate, short } from "../../core/platform/time.js";
import { xi } from "../../core/ui/icons/icon.js";
import { undoRingHtml } from "../../core/ui/undo-ring.js";
import { cadenceWords } from "./model.js";
import { UNDO_MS } from "./store.js";

/** @import { Automation, AgendaDay, LastRun, RowState, WeekDay } from "./types" */

/** @param {string} icon */
export const tile = (icon, small = false) =>
  `<span class="au-tile${small ? " is-sm" : ""}" data-au-k="${esc(icon)}" aria-hidden="true">${xi(icon)}</span>`;

/** How its last run ended: a class, an icon and the words. @param {LastRun} last */
export const endOf = (last) => last.status === "failed" ? ["is-err", "x-circle", "Failed"]
  : last.status === "skipped" ? ["", "run-skipped", "Skipped"]
  : last.found === true ? ["is-need", "found", "Found something"]
  : ["is-ok", "check-circle", last.found === false ? "Nothing new" : "Done"];

/** @param {LastRun | null} last */
function resultHtml(last) {
  if (!last) return `<span class="au-r">Not run yet</span>`;
  const [cls, icon, words] = endOf(last);
  return `<span class="au-r ${cls}">${xi(icon)}${words}</span>`;
}

const MENU = /** @type {const} */ ([["run", "play", "Run now"], ["toggle", "pause", "Turn off"], ["edit", "edit", "Edit"],
  ["duplicate", "duplicate", "Duplicate"], ["runs", "history", "Past runs"]]);

/** @param {string} act @param {string} id @param {string} icon @param {string} words */
export const menuItem = (act, id, icon, words, cls = "") => `<button type="button" role="menuitem" data-au-act="${act}"` +
  `${id ? ` data-au-id="${esc(id)}"` : ""}${cls ? ` class="${cls}"` : ""}>${xi(icon)}${words}</button>`;

/** @param {string} items @param {string} id */
export const menuWrap = (items, id) => `<span class="au-menu" role="menu" tabindex="-1">${items}` +
  `<span class="au-sep" role="separator"></span>${menuItem("delete", id, "delete", "Delete…", "is-danger")}</span>`;

/** @param {Automation} a */
function menuHtml(a) {
  const rows = MENU.map(([act, icon, words]) => act === "toggle"
    ? menuItem(act, a.id, a.on ? "pause" : "play", a.on ? "Turn off" : "Turn on")
    : act === "run" && a.running ? "" : menuItem(act, a.id, icon, words));
  return menuWrap(rows.join(""), a.id);
}

/** @param {Automation} a */
export function confirmHtml(a) {
  const id = esc(a.id);
  return `<div class="wt-confirm au-confirm" role="alertdialog" aria-labelledby="au-q-${id}">` +
    `<p class="wt-q" id="au-q-${id}"><b>Delete "${esc(a.name)}"?</b> ` +
    `It stops running. Its past runs stay in Threads, and you can undo for a few seconds.</p>` +
    `<div class="set-fa"><button type="button" class="btn" data-au-act="keep" data-au-id="${id}">Keep it</button>` +
    `<button type="button" class="btn btn-danger" data-au-act="delete-now" data-au-id="${id}">Delete</button></div></div>`;
}

/** @param {Automation} a @param {number} until */
const deletedHtml = (a, until) => `<li class="au-gone" data-au-row="${esc(a.id)}"><span>"${esc(a.name)}" deleted</span>` +
  `<button type="button" class="btn" data-au-act="undo" data-au-id="${esc(a.id)}">${undoRingHtml(until, UNDO_MS)}Undo</button></li>`;

/** One automation as a row. @param {Automation} a @param {string} lead @param {RowState} s */
function rowHtml(a, lead, s) {
  const until = s.deleting.get(a.id);
  if (until) return deletedHtml(a, until);
  const id = esc(a.id), name = esc(a.name), open = s.menu === a.id;
  const sub = `${esc(cadenceWords(a))}<span>${esc(s.projectName(a.project))}</span>`;
  const side = a.on ? resultHtml(a.last) : `<span class="au-r">${esc(a.offReason)}</span>`;
  return `<li class="au-row${a.on ? "" : " is-off"}${s.selected === a.id ? " is-on" : ""}" data-au-row="${id}">` +
    `<button type="button" class="au-open" data-au-act="open" data-au-id="${id}" aria-label="${name}, ${esc(cadenceWords(a))}"></button>` +
    `<span class="au-t">${lead}</span>${tile(a.icon)}<span class="au-n"><b>${name}</b><small>${sub}</small></span>${side}` +
    `<button type="button" class="au-more" data-au-act="menu" data-au-id="${id}" aria-haspopup="menu" aria-expanded="${open}"` +
    ` aria-label="More for ${name}">${xi("more")}</button>` +
    (open ? menuHtml(a) : "") + (s.confirm === a.id ? confirmHtml(a) : "") + `</li>`;
}

/** @param {WeekDay} day */
const weekDayHtml = (day) => `<div class="${day.today ? "is-today" : day.past ? "is-past" : ""}">` +
  `<small>${esc(formatDate(day.start, "weekday"))}</small><b>${new Date(day.start).getDate()}</b>` +
  `<i>${day.dots.slice(0, 6).map((dot) => `<u data-au-k="${esc(dot.icon)}"></u>`).join("")}</i></div>`;

/** @param {WeekDay[]} week */
export const weekHtml = (week) => `<div class="au-week" aria-hidden="true">${week.map(weekDayHtml).join("")}</div>`;

/** @param {AgendaDay[]} days @param {RowState} s */
export function agendaHtml(days, s) {
  return days.map((day) => `<h2 class="au-day">${esc(day.label)}<span>${esc(formatDate(day.start, "monthDay"))}</span></h2>` +
    `<ul class="au-list">${day.items.map(({ automation, at }) => rowHtml(automation, esc(clock(at)), s)).join("")}</ul>`).join("");
}

/** @param {Automation[]} list @param {RowState} s @param {(a: Automation) => string} lead */
export const listHtml = (list, s, lead) => `<ul class="au-list">${list.map((a) => rowHtml(a, lead(a), s)).join("")}</ul>`;

/** When it last ran, for the Found something and Off lists. @param {Automation} a */
export const lastLead = (a) => a.last ? esc(short(a.last.at)) : "";

/** @param {string} title @param {string} words */
export const emptyHtml = (title, words) => `<div class="au-empty"><span class="au-empty-ic" aria-hidden="true">${xi("automation")}</span>` +
  `<b>${esc(title)}</b><p>${esc(words)}</p></div>`;
