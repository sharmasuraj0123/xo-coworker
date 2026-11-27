// @ts-check

import { esc } from "../../core/platform/index.js";
import { rtName, rtMark } from "../../core/services/runtimes.js";
import { EFFORT_WORD, EFFORT_HINT } from "./effort.js";

/** @import { PsCoordinator, PsThreads, PsNote } from "./project-settings-types.js" */

const PREF_MAX = 2000;
const READING = `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
const PREF_EXAMPLE = "Refactors and tests on Codex, UI work on Claude Code.";

const choice = (value = "", words = "", on = false) => /** @type {[string, string, boolean]} */ ([value, words, on]);

/** @param {PsNote} [n] */
const noteHtml = (n) => (!n ? "" : n.err ? `<p class="rt-ferr" role="alert">${esc(n.err)}</p>`
  : `<span class="rt-saved${n.saving ? " is-saving" : ""}" role="status">${n.saving ? "Saving…" : "Saved"}</span>`);

/** @param {string} id @param {string} label @param {string} sub @param {string} ctl @param {PsNote} [note] */
const row = (id, label, sub, ctl, note, col = false) => `<div class="set-row ps-row${col ? " is-col" : ""}">` +
  `<div class="set-l"><b id="ps-${id}">${esc(label)}</b><span>${sub}</span>${noteHtml(note)}</div>${ctl}</div>`;

/** @param {string} id @param {[string, string, boolean][]} choices value, words, on @param {string} attr @param {boolean} busy */
function seg(id, choices, attr, busy) {
  const none = !choices.some((c) => c[2]), wait = busy ? ' aria-disabled="true"' : "";
  const one = (/** @type {[string, string, boolean]} */ [v, words, on], i = 0) =>
    `<button type="button" role="radio" aria-checked="${on}" ${attr}="${esc(v)}"` +
    ` tabindex="${on || (none && i === 0) ? 0 : -1}"${wait}>${esc(words)}</button>`;
  return `<div class="rt-seg" role="radiogroup" aria-labelledby="ps-${id}">${choices.map(one).join("")}</div>`;
}

/** @param {string} title @param {string} intro */
const head = (title, intro) => `<header class="set-ph"><h2 id="ps-title" tabindex="-1">${esc(title)}</h2>` +
  `<p class="set-intro">${intro}</p></header>`;

/** @param {string} id @param {string} title @param {string} rows */
const section = (id, title, rows) => `<section class="set-sec" aria-labelledby="ps-${id}-h">` +
  `<h3 id="ps-${id}-h">${esc(title)}</h3>${rows}</section>`;

/** @param {PsCoordinator} m @param {string} busy */
function runtimeCtl(m, busy) {
  const opts = m.runtimes.map((o) => `<option value="${esc(o.id)}"${o.id === m.runtime ? " selected" : ""}` +
    `${o.usable ? "" : ` disabled data-desc="${esc(o.why)}"`}>${esc(o.id === "auto" ? "Auto" : rtName(o.id))}</option>`).join("");
  const mark = m.runtime && m.runtime !== "auto" ? rtMark(m.runtime) || "" : "";
  return `<span class="ps-ctl">${mark ? `<span class="ps-mk" aria-hidden="true">${mark}</span>` : ""}` +
    `<xo-select class="set-sel ps-sel" data-ps-rt aria-labelledby="ps-rt"${busy}>${opts}</xo-select></span>`;
}

/** @param {PsCoordinator} m @param {string} busy */
function modelCtl(m, busy) {
  if (!m.models) {
    const now = m.auto || !m.model ? `<option value="" selected>Auto</option>`
      : `<option value="${esc(m.model)}" selected>${esc(m.modelName)}</option>`;
    return `<xo-select class="set-sel ps-sel" data-ps-model aria-labelledby="ps-model" aria-busy="true">${now}</xo-select>`;
  }
  const opts = m.models.map((x) => `<option value="${esc(x.id)}"${!m.auto && x.id === m.model ? " selected" : ""}` +
    `${x.description ? ` data-desc="${esc(x.description)}"` : ""}>${esc(x.name || x.id)}</option>`).join("");
  return `<xo-select class="set-sel ps-sel" data-ps-model aria-labelledby="ps-model"${busy}>` +
    `<option value=""${m.auto ? " selected" : ""} data-desc="XO picks for each turn">Auto</option>${opts}</xo-select>`;
}

/** The coordinator: what it runs on, and who reads a new message first. @param {PsCoordinator} m */
export function coordinatorHtml(m) {
  const busy = m.busy ? ' aria-busy="true"' : "";
  const efforts = m.efforts.map((e) => choice(e, EFFORT_WORD[e] || e, e === m.effort));
  const thinkSub = esc(EFFORT_HINT[m.effort || ""] || "How long it thinks before it answers.");
  const thinkSeg = seg("think", efforts, "data-ps-effort", m.busy);
  const think = efforts.length ? row("think", "Thinking", thinkSub, thinkSeg, m.notes.think, true) : "";
  const rtSub = `From its next pause, and for its new threads.${m.rtNote ? ` ${esc(m.rtNote)}` : ""}`;
  const routes = m.routes.map((r) => choice(r.id, r.label, r.on));
  return head("Coordinator", `The agent that reads what you write to ${esc(m.name)}, answers, and starts its threads.`) +
    section("run", "What it runs on",
      row("rt", "Runtime", rtSub, runtimeCtl(m, busy), m.notes.rt) +
      row("model", "Model", m.auto ? "Auto lets XO pick for each turn." : "From its next turn.", modelCtl(m, busy), m.notes.model) +
      think) +
    section("msg", "Messages",
      row("route", "Who routes a new message", esc(m.routeLine), seg("route", routes, "data-ps-route", m.busy), m.notes.route));
}

/** @param {PsThreads} m */
function prefRow(m) {
  return `<div class="set-row ps-row is-col"><div class="set-l"><label for="ps-pref"><b id="ps-preferences">In your words</b></label>` +
    `<span>Read when its coordinator picks a runtime for a new thread. Empty, it reads the Space's.</span>` +
    `${noteHtml(m.notes.preferences)}</div><div class="field"><textarea id="ps-pref" rows="3" maxlength="${PREF_MAX}" data-ps-pref` +
    ` placeholder="${esc(m.spacePref || PREF_EXAMPLE)}">${esc(m.pref)}</textarea></div></div>`;
}

/** A project's new threads: where they run, where they may, and what happens at a limit. @param {PsThreads} m */
export function threadsHtml(m) {
  if (!m.ready) return head("New threads", "Where the threads it starts run.") + READING;
  const space = (words = "") => `The Space's (${words})`;
  const usual = seg("default", [choice("", space(m.spaceDefault ? rtName(m.spaceDefault) : "Auto"), !m.own.default),
    ...m.allowed.map((n) => choice(n, rtName(n), m.own.default === n))], "data-ps-default", m.busy);
  const check = (/** @type {string} */ n) => `<label class="rt-check"><input type="checkbox" data-ps-allowed="${esc(n)}"` +
    `${m.allowed.includes(n) ? " checked" : ""}${m.busy ? " disabled" : ""}><span>${esc(rtName(n))}</span></label>`;
  const checks = `<div class="rt-checks" role="group" aria-labelledby="ps-allowed">${m.installed.map(check).join("")}</div>`;
  const allowedSub = m.own.allowed
    ? `Only these, for this project. <button type="button" class="cp-link" data-ps-allowed-space>Use the Space's</button>`
    : "The Space's, until you change one here. Work never goes to a runtime that is off.";
  const fb = (/** @type {boolean | null} */ v) => (v ? "On" : "Off");
  const fallback = seg("fallback", [choice("", space(fb(m.spaceFallback)), m.own.fallback == null),
    choice("on", "On", m.own.fallback === true), choice("off", "Off", m.own.fallback === false)], "data-ps-fallback", m.busy);
  const fbSub = "When a runtime can't take work, a new thread may start on another one. " +
    "<strong>It goes to another provider without asking you.</strong>";
  return head("New threads", `Where the threads ${esc(m.name)}'s coordinator starts run, when it doesn't choose.`) +
    section("where", "Where they run",
      row("default", "Usual runtime", "Where a new thread runs when its coordinator doesn't choose.", usual, m.notes.default, true) +
      row("allowed", "Runtimes it may use", allowedSub, checks, m.notes.allowed, true) +
      row("fallback", "Start elsewhere at a limit", fbSub, fallback, m.notes.fallback, true)) +
    section("choose", "How its coordinator chooses", prefRow(m));
}
