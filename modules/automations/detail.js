// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { DAY_MS, formatDate, startOfDay } from "../../core/platform/time.js";
import { rtMark } from "../../core/services/runtimes.js";
import { xi } from "../../core/ui/icons/icon.js";
import { renderMarkdown } from "../../core/ui/markdown/markdown.js";
import { titleOf } from "./agent-file.js";
import { runsOnWords } from "./agent-views.js";
import { cadenceOf, cadenceWords, dayMonth, foundWords, hhmm, longDate, ordinal } from "./model.js";
import { confirmHtml, lettersHtml, menuItem, menuWrap, NOTIFY, ON_FAILURE, switchHtml, tile } from "./views.js";

/** @import { Automation, DetailState, ReportState, RunRow } from "./types" */

/** The alarm: the time it runs, big, and the days. @param {Automation} a */
function alarmHtml(a) {
  const { kind, at, days, dom } = cadenceOf(a);
  if (!Number.isFinite(at) || kind === "hour" || kind === "minute") return "";
  const time = `<b>${esc(hhmm(at))}</b>`;
  if (kind === "once" || kind === "month") {
    const day = kind === "once" ? longDate(at) : dom === "last" ? "Last day of each month" : `The ${ordinal(Number(dom))} of each month`;
    return `<div class="au-alarm">${time}<span class="au-wk">${esc(day)}</span></div>`;
  }
  return `<div class="au-alarm">${time}${lettersHtml(days)}</div>`;
}

/** How often, and when next: "Weekdays · next Monday 30 November"; a one-off's alarm already says both. @param {Automation} a */
function whenWords(a) {
  const often = cadenceWords(a), { kind, at } = cadenceOf(a);
  if (kind === "once" && Number.isFinite(at)) return "";
  if (!a.on || !Number.isFinite(a.next)) return often;
  const hourly = kind === "hour" || kind === "minute";
  return `${often} · next ${hourly ? `${hhmm(a.next)}, ` : ""}${longDate(a.next)}`;
}

/** @param {Automation} a */
const nextHtml = (a) => { const w = whenWords(a); return w ? `<p class="au-next">${esc(w)}</p>` : ""; };

/** Words alone, so a name taken from what it does reads as the same. @param {string} t */
const plain = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** What it does, unless its name already says all of it. @param {Automation} a */
const promptHtml = (a) => plain(a.prompt) === plain(a.name) ? ""
  : `<section class="au-sec"><h3>Each time</h3><p class="au-prompt">${esc(a.prompt)}</p></section>`;

/** When a run was, by day and time. @param {number} at */
function runWhen(at, now = Date.now()) {
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(new Date(at))) / DAY_MS);
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : days > 0 && days < 7 ? formatDate(at, "weekday") : dayMonth(at);
  return `${day} ${hhmm(at)}`;
}

/** @param {RunRow} run @returns {[string, string, string]} */
const runLook = (run) => run.status === "failed" ? ["is-err", "x-circle", "Failed"]
  : run.status === "skipped" ? ["", "run-skipped", "Skipped"]
  : run.found === true ? ["is-need", "found", foundWords(run)]
  : ["is-ok", "check-circle", run.found === false ? "Nothing new" : "Ran"];

/** What a run says beside its words. @param {RunRow} run */
const runLine = (run) => run.status === "skipped" ? run.reason || "The run before it was still working"
  : run.status === "failed" ? run.reason : run.summary || (run.manual ? "Run by hand" : "");

/** @param {RunRow} run */
function runHtml(run) {
  const [cls, icon, words] = runLook(run), line = runLine(run);
  const inner = `${xi(icon)}<span><b>${esc(words)}</b>${line ? `<small>${esc(line)}</small>` : ""}</span>` +
    `<time>${esc(runWhen(run.at))}</time>`;
  const body = run.thread ? `<button type="button" class="au-run" data-au-act="report" data-au-key="${esc(run.key)}">${inner}</button>`
    : `<span class="au-run">${inner}</span>`;
  return `<li class="${cls}">${body}</li>`;
}

/** A setting; one that opens something has a chevron. @param {string} icon @param {string} k @param {string} v @param {string} [act] */
const kv = (icon, k, v, act = "") => act
  ? `<li><button type="button" class="au-kv-go" data-au-act="${act}">${xi(icon)}<span>${esc(k)}</span><b>${esc(v)}</b>` +
    `${xi("chevron-right")}</button></li>`
  : `<li>${xi(icon)}<span>${esc(k)}</span><b>${esc(v)}</b></li>`;

/** The bar: back to the list on the page, then ••• and the switch. @param {Automation} a @param {DetailState} s */
function barHtml(a, s) {
  const menu = s.menu ? menuWrap(menuItem("duplicate", a.id, "duplicate", "Duplicate") +
    (s.where === "panel" ? menuItem("all", "", "automation", "Show all automations") : ""), a.id) : "";
  const more = `<button type="button" class="au-more" data-au-act="detail-menu" aria-haspopup="menu" aria-expanded="${s.menu}"` +
    ` aria-label="More">${xi("more")}</button>`;
  const back = s.where === "page" ? `<button type="button" class="au-back" data-au-act="close">${xi("chevron-left")}Automations</button>`
    : "<span></span>";
  return `<div class="au-bar">${back}<span class="au-acts-end">${more}${menu}${switchHtml(a, s.turning)}</span></div>`;
}

/** @param {Automation} a */
function actsHtml(a) {
  const id = esc(a.id);
  const run = `<button type="button" class="btn" data-au-act="run" data-au-id="${id}"${a.running ? ' aria-disabled="true"' : ""}` +
    `${busyAttrs(`au-run:${a.id}`)}>${xi("play")}${a.running ? "Running…" : "Run now"}</button>`;
  const edit = `<button type="button" class="btn" data-au-act="edit" data-au-id="${id}">${xi("edit")}Edit</button>`;
  return `<div class="au-acts">${run}${edit}</div>`;
}

/** @param {DetailState} s */
const runsHtml = (s) => s.runsFailed ? `<p class="au-none">Couldn't read its past runs.</p>`
  : !s.runs ? `<p class="au-none">Reading its past runs…</p>`
  : s.runs.length ? `<ul class="au-runs">${s.runs.map(runHtml).join("")}</ul>` : `<p class="au-none">It hasn't run yet.</p>`;

/** Its agent, project, and who allowed it. @param {Automation} a @param {DetailState} s */
function settingsHtml(a, s) {
  const who = a.persona ? `${titleOf(a.persona.name)}${a.persona.level === "space" ? " · Every project" : ""}` : "";
  const mark = a.runtime ? rtMark(a.runtime) ?? "" : "";
  const agent = a.persona ? kv("agent", "Agent", who, "agent") : kv("agent", "Agent", runsOnWords(a)).replace("<b>", `<b>${mark}`);
  return `<ul class="au-kv">${agent}${kv("project", "Project", s.projectName, "project")}` +
    `${a.notify ? kv("bell", "Tells you", NOTIFY.find(([v]) => v === a.notify)?.[1] ?? "") : ""}` +
    `${a.onFailure ? kv("alert", "If it fails", ON_FAILURE.find(([v]) => v === a.onFailure)?.[1] ?? "") : ""}` +
    `${a.askedBy === "agent" ? kv("shield-check", "Allowed", a.approved ? "By you" : "Not yet") : ""}</ul>`;
}

/** One automation: when it runs, what it does, its settings and its runs. @param {Automation} a @param {DetailState} s */
export function detailHtml(a, s) {
  return `<article class="au-det au-view" data-key="detail:${esc(a.id)}" aria-labelledby="au-det-h">${barHtml(a, s)}` +
    `<div class="au-hd">${tile(a.icon)}<h2 id="au-det-h" tabindex="-1">${esc(a.name)}</h2></div>` +
    alarmHtml(a) + nextHtml(a) + actsHtml(a) +
    (s.confirm ? confirmHtml(a) : "") +
    (a.on ? "" : `<p class="au-off">${xi("pause")}${esc(a.offReason)}</p>`) +
    promptHtml(a) +
    `<section class="au-sec">${settingsHtml(a, s)}</section>` +
    `<section class="au-sec"><h3>Runs</h3>${runsHtml(s)}</section></article>`;
}

/** @param {ReportState} r */
const reportBody = (r) => r.failed ? `<p class="au-none">Couldn't read its report.</p>`
  : r.text === null ? `<div class="au-loading" role="status"><i class="spin is-load" aria-hidden="true"></i>` +
    `<span class="sr-only">Reading its report</span></div>`
  : r.text.trim() ? `<div class="prose au-report">${renderMarkdown(r.text)}</div>` : `<p class="au-none">This run left no report.</p>`;

/** One run: what it found, when, and its report. @param {Automation} a @param {RunRow} run @param {ReportState} r */
export function reportHtml(a, run, r) {
  const [cls, icon, words] = runLook(run), line = runLine(run), to = run.thread;
  const open = to ? `<div class="au-acts"><button type="button" class="btn" data-au-act="thread" data-chat="${esc(to.chat)}"` +
    ` data-ts="${esc(to.ts)}">${xi("thread")}Open the run</button></div>` : "";
  const when = [runWhen(run.at), a.persona ? titleOf(a.persona.name) : ""].filter(Boolean).join(" · ");
  return `<article class="au-det au-view ${cls}" data-key="report:${esc(run.key)}" aria-labelledby="au-det-h"><div class="au-bar">` +
    `<button type="button" class="au-back" data-au-act="report-back">${xi("chevron-left")}${esc(a.name)}</button></div>` +
    `<div class="au-hd"><span class="au-tile au-run-tile" aria-hidden="true">${xi(icon)}</span>` +
    `<h2 id="au-det-h" tabindex="-1">${esc(words)}</h2></div><p class="au-next">${esc(when)}</p>` +
    (line && (r.failed || r.text !== null && (run.status !== "ok" || !r.text.trim())) ? `<p class="au-prompt">${esc(line)}</p>` : "") +
    open + `<section class="au-sec">${reportBody(r)}</section></article>`;
}
