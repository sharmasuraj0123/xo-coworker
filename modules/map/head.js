// @ts-check
import { esc } from "../../core/platform/util.js";
import { heldWords } from "../../core/services/world/held.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @import { MapAgent, MapThread } from "./agents-types.d.ts" */

/** @import { MapFolder } from "./folders-types.d.ts" */

/** @typedef {{ kind: "thread", t: MapThread & { branch?: string | null }, fold: MapFolder | null } | { kind: "project", pid: string } | { kind: "all" }} HeadScope */

/** @param {number | null} ms */
const since = (ms) => (Number.isFinite(ms) ? `<span class="elapsed" data-since="${ms}"></span>` : "");

/** @param {{ project: (id: string) => { name?: string } | null | undefined }} world @param {(agent: MapAgent) => string} doingLine @param {(agent: MapAgent) => string} verbOf */
export function createMapHead(world, doingLine, verbOf) {
  /** @param {HeadScope} scope @param {MapAgent[]} ags */
  return function headHtml(scope, ags) {
    let title, sub, extra = "";
    if (scope.kind === "thread") {
      const t = scope.t, a = ags[0];
      title = t.title;
      sub = [t.branch && `<span class="mp-br">${ICON.branch}<code>${esc(t.branch)}</code></span>`, scope.fold ? (scope.fold.base ? "its own worktree" : "the project folder") : ""].filter(Boolean).join(`<span class="mp-sep">·</span>`);
      const word = a.busy ? (a.waiting ? "Waiting for you" : doingLine(a)) : a.held ? esc(heldWords(a.held)) : t.state === "done" ? "Done" : t.state === "resolved" ? "Resolved" : t.state === "failed" ? "Stopped" : "Not working right now";
      extra = `<div class="mp-now st-${a.busy ? (a.waiting ? "wait" : "busy") : a.held ? "wait" : "rest"}" style="--c:${a.color}"><p class="mp-nl">${word}</p>${a.busy ? since(a.since) : ""}</div>`;
    } else {
      if (scope.kind === "project") { title = (world.project(scope.pid) || {}).name || scope.pid; }
      else title = "Working now";
      const n = ags.length;
      sub = n ? `${n} agent${n === 1 ? "" : "s"} at work` : scope.kind === "project" ? "No agent is working here right now" : "No agent is working right now";
      if (n) extra = `<ul class="mp-legend" aria-label="Agents">${ags.map((a) => `<li><button type="button" class="mp-who" data-mp-focus="${esc(a.id)}" style="--c:${a.color}" title="Show where it is"><i aria-hidden="true"></i><b>${esc(a.title)}</b><span>${esc(verbOf(a))}</span></button></li>`).join("")}</ul>`;
    }
    return `<header class="mp-top"><div class="mp-t"><h2 id="mp-h">${esc(title)}</h2>${sub ? `<p class="mp-sub">${sub}</p>` : ""}</div></header>` + extra;
  };
}
