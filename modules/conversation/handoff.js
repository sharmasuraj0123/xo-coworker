// @ts-check

import { clock } from "../../core/platform/time.js";
import { esc } from "../../core/platform/util.js";
import { rtName, rtMark, modelWord, EFFORT_WORD } from "../../core/services/runtimes.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @import { Setup, Strong, SetupChange, Hand, Back } from "./handoff-types.d.ts" */

const SETUP = /^The (project coordinator|workspace coordinator|coordinator) set (.+?)\.?$/;
const SEP = `<span class="ho-sep" aria-hidden="true">·</span>`;
const ARROW = `<span class="ho-arrow" aria-hidden="true">${ICON.arrow}</span>`;

/** What a coordinator's change_thread_setup line set, or null for any other line. @param {string | null | undefined} text */
export function setupOf(text) {
  const m = SETUP.exec(String(text || "").trim());
  if (!m) return null;
  /** @type {SetupChange} */
  const out = { by: m[1] };
  for (const part of m[2].split(" and ")) {
    const x = /^(the model|effort) to (\S.*)$/.exec(part.trim());
    if (!x) return null;
    if (x[1] === "effort") out.effort = x[2];
    else out.model = x[2];
  }
  return out;
}

/** @param {string | null | undefined} e */
const effortWord = (e) => (e ? EFFORT_WORD[e] || e : "");
/** @param {string} text @param {boolean} strong */
const bold = (text, strong) => (strong ? `<b>${esc(text)}</b>` : esc(text));

/** One side of a handoff, only what is known. @param {Setup} s @param {boolean} was @param {Strong} strong */
function chipHtml(s, was, strong) {
  const bits = [
    s.agent ? `<b>${esc(rtName(s.agent))}</b>` : "",
    s.model ? bold(modelWord(s.model), strong === "model") : "",
    s.effort ? bold(effortWord(s.effort), strong === "effort") : "",
  ].filter(Boolean);
  const mark = s.agent ? rtMark(s.agent) || "" : "";
  return `<span class="ho-chip${was ? " is-was" : ""}">${mark}${bits.join(SEP)}</span>`;
}

/** @param {Setup} s */
const setupWords = (s) => [s.agent ? rtName(s.agent) : "", s.model ? modelWord(s.model) : "", effortWord(s.effort)]
  .filter(Boolean).join(", ");

/** The old setup faded, an arrow, the new one, and a line in words. @param {Hand} h */
export function handoffHtml({ from = null, to, words, at, after = "", strong = null }) {
  const label = from ? `From ${setupWords(from)} to ${setupWords(to)}` : `Now ${setupWords(to)}`;
  const pair = `${from ? chipHtml(from, true, null) + ARROW : ""}${chipHtml(to, false, strong)}`;
  return `<div class="ho-card" role="group" aria-label="${esc(label)}"><span class="ho-pair">${pair}</span>` +
    `<p class="ho-words"><span class="ho-t">${words}</span>${after}<time>${esc(clock(at))}</time></p></div>`;
}

/** A coordinator's change of model or thinking. @param {SetupChange} set @param {string | null} agent @param {number} at */
export function setupHtml(set, agent, at) {
  const model = set.model ? `the model to ${modelWord(set.model)}` : "";
  const effort = set.effort ? `thinking to ${effortWord(set.effort)}` : "";
  const strong = set.effort && !set.model ? "effort" : set.model && !set.effort ? "model" : null;
  const words = `The ${esc(set.by)} set ${esc([model, effort].filter(Boolean).join(" and "))}. Same session, from its next turn.`;
  return handoffHtml({ to: { agent, model: set.model, effort: set.effort }, words, at, strong });
}

/** A thread handing its result back: its mark, an arrow, the receiver's mark, then the result's title. @param {Back} b */
export function handBackHtml({ from, to, toWho, title = null, file = null, path = null, at }) {
  const a = from ? rtMark(from) || "" : "", z = to ? rtMark(to) || "" : "";
  const marks = a || z ? `<span class="ho-mini">${a}${a && z ? ARROW : ""}${z}</span>`
    : `<span class="ev-ic">${ICON.arrow}</span>`;
  const tip = path ? ` title="${esc(path)}"` : "";
  const name = title && file ? `<button type="button" class="rt-go" data-made-file="${esc(file)}"${tip}>${esc(title)}</button>`
    : esc(title || "");
  return `<div class="ev ev-sys ev-handback" title="Handed back to ${esc(toWho)}">${marks}` +
    `<span class="ev-t">Handed back its result${title ? ` · ${name}` : ""}</span><time>${esc(clock(at))}</time></div>`;
}
