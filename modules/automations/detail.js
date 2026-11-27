// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { clock, clockWords, formatDate } from "../../core/platform/time.js";
import { xi } from "../../core/ui/icons/icon.js";
import { titleOf } from "./agent-file.js";
import { cadenceOf, cadenceWords, dayAt, ordinal } from "./model.js";
import { confirmHtml, menuItem, menuWrap, switchHtml, tile } from "./views.js";

/** @import { Automation, DetailState, RunRow } from "./types" */

/** The alarm: the time it runs, big, and the days. @param {Automation} a */
function alarmHtml(a) {
  const { kind, at, days, dom } = cadenceOf(a);
  if (!Number.isFinite(at) || kind === "hour" || kind === "minute") return "";
  const time = `<b>${esc(clock(at))}</b>`;
  if (kind === "once" || kind === "month") {
    const day = kind === "once" ? formatDate(at, "monthDay")
      : dom === "last" ? "Last day of each month" : `The ${ordinal(Number(dom))} of each month`;
    return `<div class="au-alarm">${time}<span class="au-wk">${esc(day)}</span></div>`;
  }
  const week = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const name = formatDate(dayAt(d), "weekday"), letter = esc(name.slice(0, 1));
    return days.includes(d) ? `<em title="${esc(name)}">${letter}</em>` : `<i>${letter}</i>`;
  }).join("");
  return `<div class="au-alarm">${time}<span class="au-wk" aria-hidden="true">${week}</span></div>`;
}

/** @param {RunRow} run @returns {[string, string, string]} */
const runLook = (run) => run.status === "failed" ? ["is-err", "x-circle", "Failed"]
  : run.status === "skipped" ? ["", "run-skipped", "Skipped: the last run was still working"]
  : run.found === true ? ["is-need", "found", "Found something"]
  : ["is-ok", "check-circle", run.found === false ? "Nothing new" : "Ran"];

/** @param {RunRow} run */
function runHtml(run) {
  const [cls, icon, words] = runLook(run);
  const why = run.status === "failed" && run.reason ? `<small>${esc(run.reason)}</small>` : run.manual ? "<small>Run by hand</small>" : "";
  const inner = `${xi(icon)}<span><b>${esc(words)}</b>${why}</span><time>${esc(clockWords(new Date(run.at).toISOString()))}</time>`;
  const to = run.thread, body = to ? `<button type="button" class="au-run" data-au-act="thread"` +
    ` data-chat="${esc(to.chat)}" data-ts="${esc(to.ts)}">${inner}</button>` : `<span class="au-run">${inner}</span>`;
  return `<li class="${cls}">${body}</li>`;
}

/** @param {Automation} a */
function runsOnWords(a) {
  const parts = [a.runtime, a.model, a.effort].filter(Boolean);
  return parts.length ? parts.join(" · ") : "The project's default";
}

/** @param {string} icon @param {string} k @param {string} v */
const kv = (icon, k, v) => `<li>${xi(icon)}<span>${esc(k)}</span><b>${esc(v)}</b></li>`;

/** @param {Automation} a @param {DetailState} s */
function actsHtml(a, s) {
  const id = esc(a.id);
  const menu = s.menu ? menuWrap(menuItem("duplicate", a.id, "duplicate", "Duplicate") +
    (s.where === "panel" ? menuItem("all", "", "automation", "Show all automations") : ""), a.id) : "";
  const run = `<button type="button" class="btn" data-au-act="run" data-au-id="${id}"${a.running ? ' aria-disabled="true"' : ""}` +
    `${busyAttrs(`au-run:${a.id}`)}>${xi("play")}${a.running ? "Running…" : "Run now"}</button>`;
  const more = `<button type="button" class="au-more" data-au-act="detail-menu" aria-haspopup="menu" aria-expanded="${s.menu}"` +
    ` aria-label="More">${xi("more")}</button>`;
  const toggle = switchHtml(a);
  return `<div class="au-acts">${run}<button type="button" class="btn" data-au-act="edit" data-au-id="${id}">${xi("edit")}Edit</button>` +
    `<span class="au-acts-end">${more}${menu}${toggle}</span></div>`;
}

/** @param {DetailState} s */
const runsHtml = (s) => s.runsFailed ? `<p class="au-none">Couldn't read its past runs.</p>`
  : !s.runs ? `<p class="au-none">Reading its past runs…</p>`
  : s.runs.length ? `<ul class="au-runs">${s.runs.map(runHtml).join("")}</ul>` : `<p class="au-none">It hasn't run yet.</p>`;

/** @param {Automation} a */
const nextWords = (a) => !a.on ? "Off" : Number.isFinite(a.next) ? clockWords(new Date(a.next).toISOString()) : "Not scheduled";

/** @param {Automation} a */
const madeBy = (a) => a.askedBy === "you" ? "You" : a.approved ? "An agent, allowed by you" : "An agent";

/** One automation: when it runs, its actions, what it does, its settings and its runs. @param {Automation} a @param {DetailState} s */
export function detailHtml(a, s) {
  const back = s.where === "page" ? `<button type="button" class="au-back" data-au-act="close">${xi("chevron-left")}Automations</button>`
    : "";
  return `<article class="au-det" aria-labelledby="au-det-h">${back}` +
    `<div class="au-hd">${tile(a.icon)}<div><h2 id="au-det-h" tabindex="-1">${esc(a.name)}</h2>` +
    `<p>${esc(cadenceWords(a))} · ${esc(s.projectName)}</p></div></div>` +
    alarmHtml(a) + actsHtml(a, s) +
    (s.confirm ? confirmHtml(a) : "") +
    (a.on ? "" : `<p class="au-off">${xi("pause")}${esc(a.offReason)}</p>`) +
    `<section class="au-sec"><h3>What it does each time</h3><p class="au-prompt">${esc(a.prompt)}</p></section>` +
    `<section class="au-sec"><ul class="au-kv">${kv("folder", "Project", s.projectName)}${kv("clock", "Next run", nextWords(a))}` +
    `${kv("agent-doc", "Agent", a.persona ? `${titleOf(a.persona.name)}${a.persona.level === "space" ? " · Every project" : ""}`
      : "None, just the runtime")}${kv("runtime", "Runs on", runsOnWords(a))}${kv("person", "Made by", madeBy(a))}</ul></section>` +
    `<section class="au-sec"><h3>Runs</h3>${runsHtml(s)}</section></article>`;
}
