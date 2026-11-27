// @ts-check

import { esc } from "../../core/platform/index.js";
import { modelWord, rtName } from "../../core/services/runtimes.js";
import { chartHtml, fmt } from "../../core/ui/markdown/chart.js";

/** @import {UsageDay, UsageTokens} from "../../core/platform/usage-types" @import {UsagePart, UsageState} from "./types" */

export const RANGES = [7, 30, 90];
const MODELS_SHOWN = 6;

/** Every token a runtime's model read or wrote: new input, output, and what it read from or wrote to its cache. @param {UsageTokens} t */
const allTokens = (t) => t.input + t.output + t.cache_read + t.cache_write;

/** @param {string} date an ISO day */
const dayWords = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** @param {number} share 0–1 */
const percent = (share) => (share > 0 && share < 0.01 ? "&lt;1%" : `${Math.round(share * 100)}%`);

/** A runtime's shade: the most-used is the flavour's full accent. @param {number} i its place, most-used first */
const shade = (i) => `--c:var(--series-${Math.min(i + 1, 4)})`;

/** @param {string[]} names */
const andList = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** @param {number} usd */
const dollars = (usd) => usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: usd < 100 ? 2 : 0 });

/** Runtimes that used anything in the window, most first: the first is drawn in the flavour's full accent. @param {UsagePart[]} parts */
const usedParts = (parts) => parts.filter((p) => allTokens(p.usage.total_tokens) > 0)
  .sort((a, b) => allTokens(b.usage.total_tokens) - allTokens(a.usage.total_tokens));

/** Every day row splits its tokens; a day without it is unknown, so days then count new tokens only. @param {UsagePart[]} parts */
const daysSplit = (parts) => parts.every((p) => p.usage.daily.every((d) => d.total_tokens));

/** @param {UsageDay} d @param {boolean} split */
const dayTokens = (d, split) => (split && d.total_tokens ? allTokens(d.total_tokens) : d.tokens);

/** Each day's tokens, summed across runtimes. @param {UsagePart[]} parts @param {boolean} split */
function dayTotals(parts, split) {
  /** @type {Map<string, number>} */
  const days = new Map();
  for (const p of parts) for (const d of p.usage.daily) days.set(d.date, (days.get(d.date) || 0) + dayTokens(d, split));
  return [...days].sort(([a], [b]) => (a < b ? -1 : 1));
}

/** @param {UsagePart[]} parts */
function sumTokens(parts) {
  /** @type {UsageTokens} */
  const t = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
  for (const { usage: { total_tokens: u } } of parts) {
    t.input += u.input; t.output += u.output; t.cache_read += u.cache_read; t.cache_write += u.cache_write;
  }
  return t;
}

/** @param {number} days */
function rangeHtml(days) {
  return `<div class="rt-seg us-range" role="radiogroup" aria-label="Period">${RANGES.map((n) =>
    `<button type="button" role="radio" data-us-days="${n}" aria-checked="${n === days}">${n} days</button>`).join("")}</div>`;
}

/** @param {UsagePart[]} parts @param {UsageTokens} total @param {number} days */
function heroHtml(parts, total, days) {
  const dates = dayTotals(parts, false);
  const span = dates.length ? `${dayWords(dates[0][0])} – ${dayWords(dates[dates.length - 1][0])}` : "";
  const split = [
    [total.input + total.output, "new in and out"], [total.cache_read, "read from cache"], [total.cache_write, "written to cache"],
  ].filter(([n]) => n).map(([n, words]) => `${esc(fmt(Number(n)))} ${words}`).join(" · ");
  return `<div class="us-hero"><span class="us-kicker">${esc(span)} · every runtime on this machine</span>`
    + `<b class="us-total">${esc(fmt(allTokens(total)))}</b>`
    + `<span class="us-sub">tokens in ${days} days</span><span class="us-split">${split}</span></div>`;
}

/** @param {UsagePart[]} parts @param {UsageTokens} total */
function tilesHtml(parts, total) {
  const whole = allTokens(total) || 1;
  const tiles = parts.map(({ name, usage }, i) => `<div class="us-tile"><dt><i class="us-sw" style="${shade(i)}"></i>`
    + `${esc(rtName(name))}</dt>`
    + `<dd>${esc(fmt(allTokens(usage.total_tokens)))}</dd>`
    + `<dd class="us-note">${percent(allTokens(usage.total_tokens) / whole)}${usage.estimated_tokens ? " · estimated" : ""}</dd></div>`);
  const split = daysSplit(parts);
  const busiest = dayTotals(parts, split).reduce((best, day) => (day[1] > best[1] ? day : best), ["", 0]);
  if (busiest[1]) tiles.push(`<div class="us-tile"><dt>Busiest day</dt><dd>${esc(dayWords(busiest[0]))}</dd>`
    + `<dd class="us-note">${esc(fmt(busiest[1]))} ${split ? "" : "new "}tokens</dd></div>`);
  const costed = parts.filter((p) => p.usage.total_cost > 0);
  const cost = costed.reduce((sum, p) => sum + p.usage.total_cost, 0);
  if (costed.length) tiles.push(`<div class="us-tile"><dt>Cost</dt><dd>${esc(dollars(cost))}</dd>`
    + `<dd class="us-note">${esc(costed.map((p) => rtName(p.name)).join(", "))}</dd></div>`);
  return `<dl class="us-tiles">${tiles.join("")}</dl>`;
}

/** @param {UsagePart[]} parts */
function chartBlock(parts) {
  const split = daysSplit(parts), dates = dayTotals(parts, split).map(([date]) => date);
  const spec = {
    type: "bar", stacked: true, title: split ? "Tokens each day, cache included" : "New tokens in and out, each day",
    x: { values: dates.map(dayWords) },
    series: parts.map(({ name, usage }) => {
      const byDate = new Map(usage.daily.map((d) => [d.date, dayTokens(d, split)]));
      return { name: rtName(name), values: dates.map((date) => byDate.get(date) || 0) };
    }),
  };
  return `<div class="us-chart">${chartHtml(JSON.stringify(spec)) || ""}</div>`;
}

/** @param {UsagePart[]} parts @param {UsageTokens} total */
function modelsHtml(parts, total) {
  const whole = allTokens(total) || 1;
  const rows = parts.flatMap(({ name, usage }, i) => usage.by_model.map((m) => ({ name, i, id: m.model_id, n: allTokens(m.total_tokens) })))
    .filter((m) => m.n > 0).sort((a, b) => b.n - a.n).slice(0, MODELS_SHOWN);
  if (!rows.length) return "";
  return `<section class="set-sec"><h3>Models</h3><ul class="us-models">${rows.map((m) =>
    `<li style="${shade(m.i)};--share:${(m.n / whole).toFixed(4)}"><span class="us-mn"><b>${esc(modelWord(m.id) || m.id)}</b>`
    + `<span>${esc(rtName(m.name))}</span></span><span class="us-bar" aria-hidden="true"></span>`
    + `<span class="us-mt">${esc(fmt(m.n))}</span><span class="us-mt us-note">${percent(m.n / whole)}</span></li>`).join("")}`
    + "</ul></section>";
}

/** @param {UsagePart[]} parts */
function costNote(parts) {
  const silent = parts.filter((p) => !(p.usage.total_cost > 0)).map((p) => rtName(p.name));
  if (!silent.length) return "";
  const who = `${andList(silent)} ${silent.length === 1 ? "doesn't" : "don't"}`;
  return `<p class="set-lead">${esc(who)} report a cost, so none is shown for ${silent.length === 1 ? "it" : "them"}.</p>`;
}

/** The Usage page: every runtime's tokens over the chosen days, in the flavour's colours. @param {UsageState} state */
export function usageHtml(state) {
  const lead = "<p class=\"set-lead\">What each runtime on this machine used, read from its own records: "
    + "XO's threads and anything you ran yourself.</p>";
  const failed = state.failed.map((f) => `<p class="set-err">Couldn't read ${esc(rtName(f.name))}'s usage. ${esc(f.message)}</p>`).join("");
  const head = `<div class="us-head">${lead}${rangeHtml(state.days)}</div>`;
  const reading = `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading each runtime's usage…</p>`;
  if (!state.parts) return `${head}${reading}`;
  const parts = usedParts(state.parts);
  const still = state.waiting.length ? `<p class="set-note"><i class="spin" aria-hidden="true"></i> Still reading `
    + `${esc(andList(state.waiting.map(rtName)))}…</p>` : "";
  if (!parts.length && state.waiting.length) return `${head}${failed}${reading}`;
  if (!parts.length && state.failed.length) return `${head}${failed}`;
  if (!parts.length) {
    return `${head}${failed}<p class="set-empty"><b>No usage in the last ${state.days} days.</b> `
      + "Tokens show here once a runtime has worked.</p>";
  }
  const total = sumTokens(parts);
  return `${head}${failed}${still}<div class="us-board">${heroHtml(parts, total, state.days)}`
    + `${tilesHtml(parts, total)}${chartBlock(parts)}</div>`
    + modelsHtml(parts, total) + costNote(parts);
}
