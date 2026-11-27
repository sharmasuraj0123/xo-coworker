// @ts-check

import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { EFFORT_WORD, modelWord, rtName } from "../../core/services/runtimes.js";
import { xi } from "../../core/ui/icons/icon.js";
import { MAY_WORDS, frontOf, keyOf, mayOf, titleOf } from "./agent-file.js";
import { effortOpts, modelOpts, runtimeOpts } from "./runs-on.js";
import { tile } from "./views.js";

/** @import { Importable } from "../../core/platform/persona-response-types" */

/** @import { Agent, AgentDetailState, AgentFormState, MayKey, TryState } from "./types" */

const ICON = "agent-doc";

/** @param {Agent} a */
const levelWords = (a) => a.level === "space" ? "Every project" : "This project";

/** "Claude Code · opus · Deep". @param {{ runtime: string | null, model: string | null, effort: string | null }} a */
export function runsOnWords(a) {
  const effort = a.effort ? /** @type {Record<string, string>} */ (EFFORT_WORD)[a.effort] ?? a.effort : null;
  const parts = [a.runtime ? rtName(a.runtime) : null, a.model ? modelWord(a.model) : null, effort].filter(Boolean);
  return parts.length ? parts.join(" · ") : "The project's default";
}

/** @param {Agent} a */
const usedWords = (a) => a.used_by.jobs.length === 1 ? "1 automation" : a.used_by.jobs.length ? `${a.used_by.jobs.length} automations` : "";

/** The second line: where it's kept, what replaced what, what it's for. @param {Agent} a */
export function aboutWords(a) {
  if (a.problems.length) return "Its file has a mistake";
  if (a.shadowed) return "Replaced here by this project's own";
  if (a.shadows) return `Replaces the Space's ${titleOf(a.shadows.name)}`;
  return a.description || levelWords(a);
}

/** An agent as a page row. @param {Agent} a @param {string | null} selected */
function agentRowHtml(a, selected) {
  const key = esc(keyOf(a)), name = esc(titleOf(a.name));
  return `<li class="au-row${a.shadowed ? " is-off" : ""}${selected === keyOf(a) ? " is-on" : ""}">` +
    `<button type="button" class="au-open" data-ag-act="open" data-ag-key="${key}" aria-label="${name}, ${esc(aboutWords(a))}"></button>` +
    `${tile(ICON)}<span class="au-n"><b>${name}</b><small>${esc(aboutWords(a))}</small></span>` +
    `<span class="au-r${a.problems.length ? " is-err" : ""}">` +
    `${a.problems.length ? `${xi("x-circle")}Can't run` : esc(usedWords(a))}</span>` +
    `<span></span></li>`;
}

/** @param {string} title @param {Agent[]} list @param {string | null} selected */
export const agentGroupHtml = (title, list, selected) => list.length
  ? `<h2 class="au-day">${esc(title)}</h2><ul class="au-list is-plain">${list.map((a) => agentRowHtml(a, selected)).join("")}</ul>` : "";

/** @param {string} icon @param {string} k @param {string} v */
const kv = (icon, k, v) => `<li>${xi(icon)}<span>${esc(k)}</span><b>${esc(v)}</b></li>`;

/** @param {Agent} a @param {Record<string, import("../../core/platform/persona-response-types").MayChoice>} may */
const mayWords = (a, may) => {
  const key = mayOf(a.tools, may);
  return key === "own" ? (a.tools ?? []).join(", ") : MAY_WORDS[key];
};


/** A menu row the agent side acts on. @param {string} act @param {string} icon @param {string} words */
const agItem = (act, icon, words, cls = "") =>
  `<button type="button" role="menuitem" data-ag-act="${act}"${cls ? ` class="${cls}"` : ""}>${xi(icon)}${words}</button>`;

/** @param {Agent} a @param {AgentDetailState} s */
function actsHtml(a, s) {
  const key = keyOf(a);
  const menu = s.menu ? `<span class="au-menu" role="menu" tabindex="-1">${agItem("ag-file", "doc", "Edit as file")}` +
    `<span class="au-sep" role="separator"></span>${agItem("ag-delete", "delete", "Delete…", "is-danger")}</span>` : "";
  return `<div class="au-acts"><button type="button" class="btn" data-ag-act="try"${a.problems.length ? " disabled" : ""}` +
    `${busyAttrs(`ag-try:${key}`)}>${xi("play")}Try once</button>` +
    `<button type="button" class="btn" data-ag-act="edit">${xi("edit")}Edit</button>` +
    `<span class="au-acts-end"><button type="button" class="au-more" data-ag-act="menu" aria-haspopup="menu" aria-expanded="${s.menu}"` +
    ` aria-label="More">${xi("more")}</button>${menu}</span></div>`;
}

/** @param {Agent} a */
function confirmHtml(a) {
  const jobs = a.used_by.jobs, name = esc(titleOf(a.name));
  const used = jobs.length ? ` ${jobs.length === 1 ? `"${esc(jobs[0].name)}" uses it` : `${jobs.length} automations use it`};` +
    ` ${jobs.length === 1 ? "it" : "they"} won't run until you choose another agent.` : "";
  return `<div class="wt-confirm au-confirm" role="alertdialog" aria-labelledby="ag-q"><p class="wt-q" id="ag-q"><b>Delete ${name}?</b>` +
    `${used} Its file's past versions stay in Files.</p><div class="set-fa">` +
    `<button type="button" class="btn" data-ag-act="keep">Keep it</button>` +
    `<button type="button" class="btn btn-danger" data-ag-act="delete-now">Delete</button></div></div>`;
}

/** The task a try runs, and where. @param {Agent} a @param {AgentDetailState} s @param {TryState} t */
function tryHtml(a, s, t) {
  const pick = a.level === "space" && !s.project ? `<label class="field"><span>In</span><xo-select name="try-project" class="set-sel"` +
    ` aria-label="Project">${s.projects.map((p) => `<option value="${esc(p.id)}"${p.id === t.project ? " selected" : ""}>` +
    `${esc(p.name)}</option>`).join("")}</xo-select></label>` : "";
  return `<form class="au-try" data-ag-try><label class="field"><span>Try it on</span><textarea name="task" rows="3"` +
    ` placeholder="Say in a few lines what you do and how you would go about it.">${esc(t.task)}</textarea></label>${pick}` +
    `<p class="au-note">A try only reads: nothing is saved, sent or committed. It opens as a thread.</p>` +
    `<div class="set-fa"><button type="button" class="btn" data-ag-act="try-cancel">Cancel</button>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(t.busy)}>${xi("play")}Try once</button></div></form>`;
}

/** @param {Agent} a */
const problemsHtml = (a) => a.problems.length ? `<div class="au-problem" role="note"><b>Its file has ${a.problems.length === 1
  ? "a mistake" : "mistakes"}, so it can't run:</b><ul>${a.problems.map((p) => `<li>${p.line ? `Line ${p.line}: ` : ""}` +
  `${esc(p.message)}</li>`).join("")}</ul></div>` : "";

/** @param {Agent} a */
const usedHtml = (a) => a.used_by.jobs.length
  ? `<ul class="au-kv">${a.used_by.jobs.map((j) => `<li>` +
    `<button type="button" class="au-link" data-ag-act="job" data-au-id="${esc(j.id)}">` +
    `${xi("automation")}<span>${esc(j.name)}</span>${xi("chevron-right")}</button></li>`).join("")}</ul>`
  : `<p class="au-none">No automation runs as it yet.</p>`;

/** One agent: what it's for, its actions, its instructions, its settings and what uses it. @param {Agent} a @param {AgentDetailState} s */
export function agentDetailHtml(a, s) {
  const back = s.where === "page" ? `<button type="button" class="au-back" data-ag-act="close">${xi("chevron-left")}Agents</button>` : "";
  const kept = a.level === "space" ? "Every project" : `${s.projectName(a.project)} only`;
  return `<article class="au-det" aria-labelledby="ag-det-h">${back}` +
    `<div class="au-hd">${tile(ICON)}<div><h2 id="ag-det-h" tabindex="-1">${esc(titleOf(a.name))}</h2>` +
    `<p>${esc(a.description || "No description yet: coordinators read it to choose an agent.")}</p></div></div>` +
    actsHtml(a, s) + (s.confirm ? confirmHtml(a) : "") + (s.trying ? tryHtml(a, s, s.trying) : "") + problemsHtml(a) +
    `<section class="au-sec"><h3>Instructions</h3>${s.body === null ? `<p class="au-none">Reading its file…</p>`
      : `<p class="au-prompt">${esc(s.body || "No instructions yet.")}</p>`}</section>` +
    `<section class="au-sec"><ul class="au-kv">${kv("runtime", "Runs on", runsOnWords(a))}${kv("lock", "May", mayWords(a, s.may))}` +
    `${kv("plug", "Reaches", a.mcpServers?.length ? a.mcpServers.join(", ") : "No connectors")}${kv("folder", "Kept for", kept)}` +
    `${a.shadows ? kv("duplicate", "Replaces", `The Space's ${titleOf(a.shadows.name)}`) : ""}</ul>` +
    `<p class="au-note">${esc(a.level === "space" ? `~/.quirq/agents/${a.path}` : a.path)}</p></section>` +
    `<section class="au-sec"><h3>Used by</h3>${usedHtml(a)}</section></article>`;
}

/** @param {string} value @param {string} words @param {boolean} on */
const opt = (value, words, on) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(words)}</option>`;

/** A setting as a row, its choice in a ticked chip, as Edit shows an automation's. @param {string} icon @param {string} label */
const row = (icon, label, name = "", opts = "", busy = false) => `<li>${xi(icon)}<span>${label}</span>` +
  `<xo-select name="${name}" class="au-chip" data-mark="check" aria-label="${name === "runtime" ? "Runtime" : label}"` +
  `${busy ? ' aria-busy="true"' : ""}>${opts}</xo-select></li>`;

/** What runs it, what it may do and where it's kept. @param {AgentFormState} f */
function settingsHtml(f) {
  const d = f.draft, keys = /** @type {MayKey[]} */ (["read", "edit", "run", "all"]);
  if (f.may === "own") keys.push("own");
  const here = d.level === "space" ? "space" : d.project;
  return `<ul class="au-kv">${row("runtime", "Runs on", "runtime", runtimeOpts(d.runtime, f.runtimes))}` +
    `${row("sparkles", "Model", "model", modelOpts(d.model, f.models), !f.models)}` +
    `${row("effort-think", "Thinking", "effort", effortOpts(d.effort))}` +
    `${row("lock", "May", "may", keys.map((k) => opt(k, MAY_WORDS[k], f.may === k)).join(""))}` +
    (f.isNew ? row("folder", "Kept for", "level", f.places.map(([v, words]) => opt(v, words, here === v)).join("")) : "") + `</ul>`;
}

/** The form that makes or edits an agent. @param {AgentFormState} f */
export function agentFormHtml(f) {
  const d = f.draft;
  return `<form class="au-form" data-ag-form novalidate>` +
    `<div class="au-bar"><button type="button" class="au-back" data-ag-act="cancel">Cancel</button>` +
    `<b>${esc(f.isNew ? "New agent" : "Edit agent")}</b>` +
    `<button type="submit" class="btn btn-pri"${busyAttrs(f.busy)}>Save</button></div>` +
    `<label class="field"><span>Name</span>` +
    `<input name="title" value="${esc(f.title)}" placeholder="Release checker" autocomplete="off"></label>` +
    `<label class="field"><span>What it's for</span><textarea name="description" rows="2"` +
    ` placeholder="Checks what's live against the branch and says what isn't deployed.">${esc(d.description)}</textarea></label>` +
    `<label class="field"><span>Instructions</span><textarea name="body" rows="8"` +
    ` placeholder="What it does, step by step, and what it reports.">${esc(d.body)}</textarea></label>` +
    settingsHtml(f) + `<button type="button" class="btn" data-ag-act="try-form">${xi("play")}Try what's here once</button>` +
    (f.problem ? `<p class="au-problem" role="alert">${esc(f.problem)}</p>` : "") + `</form>`;
}

/** @param {Importable} item */
const importAbout = (item) => { const about = frontOf(item.text).description; return typeof about === "string" ? about : ""; };

/** What each runtime already has, to copy in one by one. @param {Importable[] | null} items @param {string} busy */
export function importHtml(items, busy) {
  if (!items) return `<p class="au-none">Looking for agents…</p>`;
  if (!items.length) return `<p class="au-none">No agents to bring in.</p>`;
  return `<ul class="au-list is-plain">${items.map((item, i) => {
    const left = item.dropped.length ? ` · Leaves out ${item.dropped.join(", ")}` : "";
    const why = item.problems.length ? `<span class="au-r is-err">${xi("x-circle")}Can't map</span>`
      : `<button type="button" class="btn" data-ag-act="import" data-ag-i="${i}"${busyAttrs(`${busy}:${i}`)}>Bring in</button>`;
    return `<li class="au-row">${tile(ICON)}<span class="au-n"><b>${esc(titleOf(item.name))}</b>` +
      `<small><span>${esc(importAbout(item) || item.from)}</span>` +
      `<span>${esc(`${item.from} · ${item.level === "space" ? "Every project" : "This project"}${left}`)}` +
      `</span></small></span>${why}<span></span></li>`;
  }).join("")}</ul>`;
}
