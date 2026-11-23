import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";

import { ago } from "./words.js";
const DOT = { done: "d", doing: "w", failed: "x" };
const FILTERS = [["all", "All"], ["live", "Live"], ["need", "Needs you"]];
const needs = (a) => a.tone === "stop" || a.tone === "need";
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function createLpPage({ el, launch, projects, iconOf, open, press }) {
  const S = { f: "all" };
  const lead = (name, words) => (/^(GitHub|Launchpad)\b/.test(words) ? `${name}: ${words}` : `${name} ${words.charAt(0).toLowerCase()}${words.slice(1)}`);
  const tile = (p) => `<span class="lq-ic" aria-hidden="true">${iconOf(p)}</span>`;
  const state = (a) => `<span class="lqp-s"><span class="lq-eye${a.tone ? ` t-${a.tone}` : ""}"><i aria-hidden="true"></i><span>${esc(a.words)}</span></span>${a.at ? `<small>${a.tone === "work" ? "Started " : ""}${ago(a.at)}</small>` : ""}</span>`;

  function html() {
    const all = launch.overview(projects());
    if (all.pending) return `<div class="lqp"><header><h1 class="lqp-t" id="lpp-h">Launchpad</h1></header><div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"></i><span class="sr-only">Reading your projects…</span></div></div>`;
    const apps = all.filter((a) => a.kind === "app"), off = all.filter((a) => a.kind !== "app");
    const live = apps.filter((a) => a.tone === "go").length, work = apps.filter((a) => a.tone === "work").length, need = apps.filter(needs);
    const parts = [live && `${live} ${live === 1 ? "is" : "are"} live`, work && `${work} ${work === 1 ? "is" : "are"} deploying`, need.length && `${need.length} ${need.length === 1 ? "needs" : "need"} you`].filter(Boolean);
    const sum = !apps.length ? "None of your projects is on Launchpad yet." : `<b>${count(apps.length, "app")}</b> from your projects.${parts.length ? ` ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.` : ""}`;
    const shown = apps.filter((a) => S.f === "all" || (S.f === "live" ? a.tone === "go" : needs(a)));
    return `<div class="lqp"><header><h1 class="lqp-t" id="lpp-h">Launchpad</h1><p class="lqp-sum">${sum}</p></header>` +
      (need.length ? `<section class="lqp-need" aria-labelledby="lqp-need-h"><p class="lq-h" id="lqp-need-h">Needs you</p>${need.map((a) => `<div class="lq-note t-stop"><div class="lq-nc">${tile(a.p)}<div><b>${esc(lead(a.name, a.words))}</b>${a.need.why ? `<p>${esc(a.need.why)}</p>` : ""}</div></div>` +
        `<div class="lq-acts">${a.log ? `<a class="btn" href="${esc(a.log)}" target="_blank" rel="noopener"><span>Show log</span></a>` : ""}<button type="button" class="btn btn-pri" data-lpp-open="${esc(a.p)}"${a.need.act ? ` data-lpp-press="${esc(a.need.act)}"` : ""}>${esc(a.need.label || "Open")}</button></div></div>`).join("")}</section>` : "") +
      (apps.length ? (apps.length > 2 ? `<div class="lqp-bar"><div class="rt-seg" role="radiogroup" aria-label="Show">${FILTERS.map(([k, t]) => `<button type="button" role="radio" data-lpp-f="${k}" aria-checked="${S.f === k}">${t}</button>`).join("")}</div></div>` : "") +
        `<p class="lq-h">On the web</p><div class="lq-group">${shown.map((a) => `<button type="button" class="lqp-app${a.tone ? "" : " is-off"}" data-lpp-open="${esc(a.p)}" aria-label="${esc(`${a.name}: ${a.words}`)}">${tile(a.p)}<span class="lqp-c"><b>${esc(a.name)}</b><span class="lqp-a">${esc(a.host || "No address yet")}</span></span>` +
          `<span class="lqp-dots" aria-hidden="true">${a.steps.map((x) => `<i${DOT[x] ? ` class="${DOT[x]}"` : ""}></i>`).join("")}</span>${state(a)}<span class="lqp-chev" aria-hidden="true">${ICON.right}</span></button>`).join("") || `<p class="lqp-none">Nothing ${S.f === "live" ? "live" : "needs you"} right now.</p>`}</div>` : "") +
      (off.length ? `<p class="lq-h">Not on Launchpad yet</p><div class="lq-group lqp-off">${off.map((a, i) => `<div class="lqp-app">${tile(a.p)}<span class="lqp-c"><b>${esc(a.name)}</b><span class="lqp-a">${a.kind === "needs" ? "Needs preparing first" : "Ready to deploy"}</span></span>` +
        `<button type="button" class="btn${a.kind === "ready" && !off.slice(0, i).some((x) => x.kind === "ready") ? " btn-pri" : ""}" data-lpp-open="${esc(a.p)}">${a.kind === "needs" ? "Prepare" : "Deploy"}</button></div>`).join("")}</div>` : "") +
      `</div>`;
  }

  el.addEventListener("click", (e) => {
    const f = e.target.closest("[data-lpp-f]");
    if (f) { S.f = f.dataset.lppF; render(); el.querySelector(`[data-lpp-f="${S.f}"]`)?.focus({ preventScroll: true }); return; }
    const o = e.target.closest("[data-lpp-open]");
    if (!o) return;
    open(`p:${o.dataset.lppOpen}`, o);
    if (o.dataset.lppPress) press(o.dataset.lppPress);
  });

  function render() { const h = html(); if (el._h !== h) { redraw(el, h); el._h = h; } }
  return { render };
}
