// @ts-check

import { esc } from "../../core/platform/index.js";
import { xi } from "../../core/ui/icons/icon.js";
import { rtName, rtMark, healthOf, windowsOf } from "../../core/services/runtimes.js";
import { EFFORT_HINT } from "./effort.js";

/** @import { Draft, IntelModel, IntelState, IntelWorld, ViewOptions } from "./intel-types.js" */

/** @typedef {{ id: string, label: string, usable: boolean, why: string }} RtOption */

/** How long each effort thinks, in steps of five. @type {Record<string, number>} */
export const PIPS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };

const CHECK = xi("check", "iq-ck");
const GO = xi("chevron-right", "iq-go");
const BACK = `<button type="button" class="iq-hb" data-lback aria-label="Back">${xi("chevron-left")}</button>`;
export const PROJECT = `<button type="button" class="iq-item is-link" data-lproject>${xi("gear", "iq-lead")}` +
  `<span class="iq-k">Project settings</span>${GO}</button>`;

/** @param {number} n */
export const pips = (n) => `<span class="iq-pips" aria-hidden="true">` +
  `${[1, 2, 3, 4, 5].map((i) => `<i${i <= n ? ' class="is-on"' : ""}></i>`).join("")}</span>`;

/** @param {string} pg @param {string} k @param {string} v @param {string} attrs */
export const item = (pg, k, v, attrs) => `<button type="button" class="iq-item" data-lpage="${pg}" aria-haspopup="true"${attrs}>` +
  `<span class="iq-k">${k}</span><span class="iq-v">${v}</span>${GO}</button>`;

/** @param {string} title @param {string} sub */
export const pageHead = (title, sub) => `<header class="iq-h">${BACK}` +
  `<h2 id="iq-hh">${esc(title)}${sub ? ` <span>${esc(sub)}</span>` : ""}</h2></header>`;

/** @param {string} inner @param {boolean} sel @param {string} attrs */
const opt = (inner, sel, attrs) => `<button type="button" class="iq-opt${sel ? " is-sel" : ""}" role="radio"` +
  ` aria-checked="${sel}"${attrs}>${inner}${CHECK}</button>`;

/** @param {string} key @param {string} rows */
const optsHtml = (key, rows) => `<div class="iq-opts" data-key="${key}" role="radiogroup" aria-labelledby="iq-hh">${rows}</div>`;

/** @param {string} name @param {string} [desc] */
const named = (name, desc) => (desc ? `<span class="iq-stack"><span class="iq-n">${esc(name)}</span>` +
  `<span class="iq-d">${esc(desc)}</span></span>` : `<span class="iq-n">${esc(name)}</span>`);

/** @typedef {{ world: IntelWorld, catalogState: ViewOptions["catalogState"], WAIT: string }} PageDeps */

/** The picker's pages (runtime, model, thinking), as HTML. @param {IntelState} P @param {PageDeps} deps */
export function createIntelPages(P, { world, catalogState, WAIT }) {
  const { kindOf, shown, effortWord } = catalogState;
  /** Beside a runtime's name: why it can't take work, how near its limit it is, else nothing. @param {RtOption} o */
  function rtNote(o) {
    if (!o.usable) return { text: o.why.replace(/\.$/, ""), warn: false };
    const rt = (world.state.runtimes || []).find((x) => x.name === o.id);
    const h = rt ? healthOf(rt) : null, w = rt ? windowsOf(rt)[0] : null;
    if (h && h.tone === "warn" && w && w.utilization != null) return { text: `${Math.round(w.utilization * 100)}% used`, warn: true };
    return { text: h && h.tone !== "ok" ? h.word : "", warn: !!h && h.tone === "warn" };
  }
  /** @param {RtOption} o @param {boolean} sel @param {boolean} wait */
  function rtRow(o, sel, wait) {
    const n = rtNote(o), mark = o.id === "auto" ? xi("suggestion") : rtMark(o.id) || "";
    const note = n.text ? `<span class="iq-s${n.warn ? " is-warn" : ""}">${esc(n.text)}</span>` : "";
    const attrs = ` data-lrt="${esc(o.id)}"${!o.usable ? ` aria-disabled="true" title="${esc(o.why)}"` : wait ? WAIT : ""}`;
    const name = esc(o.id === "auto" ? "Auto" : rtName(o.id));
    return opt(`<span class="iq-mk">${mark}</span><span class="iq-n">${name}</span>${note}`, sel, attrs);
  }
  /** @param {string} s @param {{ list: RtOption[], on: string | null }} rc */
  function runtimePage(s, rc) {
    const kind = kindOf(s), wait = !!(P.busy || P.saving), cur = kind === "thread" ? P.rt || rc.on : rc.on;
    const rows = rc.list.map((o) => rtRow(o, cur === o.id, wait)).join("");
    const line = kind === "thread" ? "Another runtime picks this work up in a new, linked thread."
      : kind === "project" && rc.on === "auto" ? "On Auto its coordinator picks a runtime for each new thread."
      : "It moves at its next pause, on that runtime's default model.";
    return optsHtml("opts-rt", rows) + (line ? `<p class="iq-rl">${line}</p>` : "");
  }
  /** @param {string | null} kind @param {Draft} d @param {string} wait */
  function modelPage(kind, d, wait) {
    const auto = kind !== "thread" ? opt(named("Auto", "XO picks for each turn"), d.auto, ` data-dmodel=""${wait}`) : "";
    const row = (/** @type {IntelModel} */ m) => opt(named(m.name || m.id, m.description || ""), !d.auto && d.model === m.id,
      ` data-dmodel="${esc(m.id)}" title="${esc(m.description || "")}"${wait}`);
    return optsHtml("opts-model", auto + shown(P.models || []).map(row).join(""));
  }
  /** @param {string[]} efs @param {Draft} d @param {string} wait */
  function thinkPage(efs, d, wait) {
    const row = (/** @type {string} */ e) => opt(`${pips(PIPS[e])}${named(effortWord(e), EFFORT_HINT[e])}`, d.effort === e,
      ` data-deffort="${esc(e)}"${wait}`);
    return optsHtml("opts-think", efs.map(row).join(""));
  }
  return { runtimePage, modelPage, thinkPage };
}
