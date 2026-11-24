// @ts-check

import { esc } from "../../core/platform/util.js";
import { dial, ICON } from "../../core/ui/icons/names.js";

/** @import {HomeViewDeps, HomeViewNeed} from "./view-types.d.ts" */

/** @param {number} count */
function laterButton(count) {
  return `<button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}`
    + `${count} later today <span>bring back</span></button>`;
}

/** @param {HomeViewNeed} need @param {Pick<HomeViewDeps, "EFFORT" | "askTitle" | "PROJ">} options */
function thenRow(need, { EFFORT, askTitle, PROJ }) {
  const risk = need.risk === "destructive" ? '<span class="risk r-destructive">Destructive</span>'
    : need.group === "stopped" ? '<span class="risk r-stopped">Stopped</span>' : "";
  const coordinator = need.t.asker ? " coordinator" : "";
  return `<li><button type="button" class="then-i r-${need.risk}" data-fid="then-${esc(need.key)}" data-decide="${esc(need.key)}">`
    + `<span class="eff e-${need.effort}">${dial(need.effort)}<b>${EFFORT[need.effort].label}</b></span>`
    + `<span class="ti-t">${askTitle(need)}</span>`
    + `<span class="ti-p">${risk}<span class="ti-w">${esc(PROJ(need.t.project))}${coordinator}</span></span>${ICON.right}</button></li>`;
}

/** @param {ReturnType<HomeViewDeps["homeParts"]>} parts @param {Pick<HomeViewDeps, "EFFORT" | "askTitle" | "PROJ">} options */
export function thenHtml(parts, options) {
  const later = parts.later.length ? laterButton(parts.later.length) : "";
  if (!parts.then.length) return later ? `<div class="then-foot solo">${later}</div>` : "";
  const rows = parts.then.map((need) => thenRow(need, options)).join("");
  const more = parts.more.length
    ? `<button type="button" class="hm-quiet" data-fid="more" data-open-all>+${parts.more.length} more</button>` : "";
  const glances = parts.glances.length >= 2
    ? `<button type="button" class="hm-quiet is-glance" data-fid="glances" data-glances>${dial("glance")}`
      + `Clear ${parts.glances.length} glances together</button>` : "";
  const foot = more || glances || later ? `<div class="then-foot">${more}${glances}${later}</div>` : "";
  return '<section class="then" aria-labelledby="then-h"><h2 class="hm-lbl" id="then-h">Then</h2>'
    + `<ol>${rows}</ol>${foot}</section>`;
}
