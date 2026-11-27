// @ts-check

import { esc } from "../../core/platform/util.js";
import { clockWords } from "../../core/platform/time.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { cadenceWords } from "./model.js";
import { endOf } from "./views.js";

/** @import { Automation, FrameDeps } from "./types" */

/** On first, soonest first; off ones after. @param {Automation} a @param {Automation} b */
const bySoonest = (a, b) => Number(b.on) - Number(a.on) || (a.next || Infinity) - (b.next || Infinity) || a.name.localeCompare(b.name);

/** @param {Automation} a @param {number} now */
function rowHtml(a, now) {
  const id = esc(a.id), cadence = cadenceWords(a);
  const ended = a.on ? a.last ? endOf(a.last)[2] : "Not run yet" : a.offReason;
  const when = a.on && Number.isFinite(a.next) ? clockWords(new Date(a.next).toISOString(), now) : "Off";
  return `<li><button type="button" class="ag-r${a.on ? "" : " is-idle"}" data-au-act="open" data-au-id="${id}"` +
    ` aria-label="${esc(`${a.name}. ${cadence}. ${ended}`)}">` +
    `<span class="ag-ic" data-au-k="${esc(a.icon)}" aria-hidden="true">${xi(a.icon)}</span>` +
    `<span class="ag-t"><b>${esc(a.name)}</b><span class="ag-activity"><span class="ag-doing">` +
    `${esc(cadence)} · ${esc(ended)}</span></span></span>` +
    `<span class="ag-tm"><span class="ag-when">${esc(when)}</span></span></button></li>`;
}

/** A project's automations under its Threads in the panel; one opens as the panel's page. @param {FrameDeps} deps */
export function createAutomationsFrame(deps) {
  const now = deps.now ?? Date.now;
  /** @param {string} view */
  const mine = (view) => {
    const chat = deps.chatOf(view), { list, deleting } = deps.store.state;
    return chat ? list.filter((a) => a.project === chat && !deleting.has(a.id)).sort(bySoonest) : [];
  };
  return {
    id: "automations", title: "Automations",
    /** @param {HTMLElement} host */
    mount(host) {
      /** @param {Event} e */
      const onClick = (e) => {
        const row = e.target instanceof Element ? e.target.closest("[data-au-act=open]") : null;
        const id = row?.getAttribute("data-au-id");
        if (id) deps.open(id);
      };
      host.addEventListener("click", onClick);
      const unwatch = deps.store.watch(() => deps.changed());
      return {
        /** @param {string} view */
        count(view) { deps.store.fresh(); return mine(view).length; },
        /** @param {string} view */
        paint(view) { redraw(host, `<ul class="ag-list">${mine(view).map((a) => rowHtml(a, now())).join("")}</ul>`); },
        /** @param {string} view */
        create(view) { deps.create(deps.chatOf(view) ?? ""); },
        dispose() { unwatch(); host.removeEventListener("click", onClick); },
      };
    },
  };
}
