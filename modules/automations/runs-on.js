// @ts-check

import { esc } from "../../core/platform/util.js";
import { EFFORT_WORD, modelWord, offeredModels, rtMarkName, rtName } from "../../core/services/runtimes.js";

/** @import { RuntimeModel } from "../../core/platform/runtime-response-types" */

/** @param {string} value @param {string} words @param {boolean} on @param {string} [attrs] */
const opt = (value, words, on, attrs = "") => `<option${attrs} value="${esc(value)}"${on ? " selected" : ""}>${esc(words)}</option>`;

/** A runtime, its mark beside its name. @param {string} r @param {boolean} on */
const rtOpt = (r, on) => opt(r, rtName(r), on, ` data-agm="${esc(rtMarkName(r))}"`);

/** The runtimes, the chosen one kept when it is gone. @param {string | null} rt @param {string[]} runtimes @param {string} [none] */
export const runtimeOpts = (rt, runtimes, none = "Default") => [...(none ? [opt("", none, !rt)] : []),
  ...runtimes.map((r) => rtOpt(r, rt === r)), ...(rt && !runtimes.includes(rt) ? [rtOpt(rt, true)] : [])].join("");

/** The runtime's own models; while they come, only what is chosen. @param {string | null} m @param {RuntimeModel[] | null} models */
export function modelOpts(m, models, none = "Default") {
  const list = offeredModels(models ?? []);
  const known = list.map((x) => opt(x.id, x.name || x.id, x.id === m, x.description ? ` data-desc="${esc(x.description)}"` : ""));
  return [opt("", none, !m), ...(m && !list.some((x) => x.id === m) ? [opt(m, modelWord(m), true)] : []), ...known].join("");
}

/** How hard it thinks. @param {string | null} e @param {(word: string) => string} [say] */
export const effortOpts = (e, none = "Default", say = (w) => w) =>
  [opt("", none, !e), ...Object.entries(EFFORT_WORD).map(([k, w]) => opt(k, say(w), e === k))].join("");
