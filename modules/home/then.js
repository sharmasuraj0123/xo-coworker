// @ts-check

import { esc } from "../../core/platform/util.js";
import { dial, ICON } from "../../core/ui/icons/names.js";
import { arrival } from "./inbox.js";

/** @import {HomeViewDeps, HomeViewNeed, ThenFields} from "./view-types.d.ts" */

/** @import {InboxItem} from "../../core/platform/inbox-response.js" */

/** @type {{items:InboxItem[], failed:boolean, filter:string, expanded:boolean}} */
const empty = { items: [], failed: false, filter: "All", expanded: false };

/** @param {number} count */
function laterButton(count) {
  return `<button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}`
    + `${count} later today <span>bring back</span></button>`;
}

/** @template {HomeViewNeed} N @param {N} need @param {Pick<HomeViewDeps<N>, ThenFields>} options */
function thenRow(need, { EFFORT, askTitle, PROJ }) {
  const risk = need.risk === "destructive" ? '<span class="risk r-destructive">Destructive</span>'
    : need.group === "stopped" ? '<span class="risk r-stopped">Stopped</span>' : "";
  const coordinator = need.t.asker ? " coordinator" : "";
  return `<li><button type="button" class="then-i r-${need.risk}" data-fid="then-${esc(need.key)}" data-decide="${esc(need.key)}">`
    + `<span class="eff e-${need.effort}">${dial(need.effort)}<b>${EFFORT[need.effort].label}</b></span>`
    + `<span class="ti-t">${askTitle(need)}</span>`
    + `<span class="ti-p">${risk}<span class="ti-w">${esc(PROJ(need.t.project))}${coordinator}</span></span>${ICON.right}</button></li>`;
}

/** @template {HomeViewNeed} N @param {ReturnType<HomeViewDeps<N>["homeParts"]>} parts @param {Pick<HomeViewDeps<N>, ThenFields>} options */
export function thenHtml(parts, options, inbox = empty) {
  const later = parts.later.length ? laterButton(parts.later.length) : "";
  if (!parts.then.length && !inbox.items.length && !inbox.failed) return later ? `<div class="then-foot solo">${later}</div>` : "";
  const decisions = inbox.filter === "Space" ? [] : parts.then.map(need => thenRow(need, options));
  const space = inbox.filter === "Decisions" ? [] : inbox.items;
  const limit = inbox.expanded ? space.length : Math.max(0, 4 - decisions.length);
  const rows = decisions.join("") + space.slice(0, limit).map(arrival).join("");
  const more = parts.more.length
    ? `<button type="button" class="hm-quiet" data-fid="more" data-open-all>+${parts.more.length} more</button>` : "";
  const glances = parts.glances.length >= 2
    ? `<button type="button" class="hm-quiet is-glance" data-fid="glances" data-glances>${dial("glance")}`
      + `Clear ${parts.glances.length} glances together</button>` : "";
  const foot = more || glances || later ? `<div class="then-foot">${more}${glances}${later}</div>` : "";
  const filters = ["All", "Decisions", "Space"].map(name =>
    `<button type="button" class="hm-quiet" data-inbox-filter="${name}" aria-pressed="${name === inbox.filter}">${name}</button>`).join("");
  const expand = space.length + decisions.length > 4
    ? `<button type="button" class="hm-quiet" data-inbox-expand>${inbox.expanded ? "Show less" : "See all"}</button>` : "";
  const status = inbox.failed && inbox.filter !== "Decisions" ? "<p>Space inbox unavailable</p>" : "";
  return '<section class="then" aria-labelledby="then-h"><header class="hm-lbl"><h2 id="then-h">Inbox</h2>'
    + `<div aria-label="Inbox filters">${filters}</div></header><ol>${rows}</ol>${status}${expand}${foot}</section>`;
}
