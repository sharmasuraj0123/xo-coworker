// @ts-check

import { esc } from "../../core/platform/util.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { keyOf, titleOf } from "./agent-file.js";
import { aboutWords } from "./agent-views.js";

/** @import { Agent, AgentFrameDeps } from "./types" */

/** The project's own first, then the Space's it still sees. @param {Agent} a @param {Agent} b */
const byLevel = (a, b) => Number(a.level === "space") - Number(b.level === "space") || a.name.localeCompare(b.name);

/** @param {Agent} a */
function rowHtml(a) {
  const name = titleOf(a.name), about = aboutWords(a);
  const where = a.problems.length ? "Can't run" : a.level === "space" ? "Space" : "";
  return `<li><button type="button" class="ag-r${a.problems.length ? " is-idle" : ""}" data-ag-act="open" data-ag-key="${esc(keyOf(a))}"` +
    ` aria-label="${esc(`${name}. ${about}`)}"><span class="ag-ic" data-au-k="agent-doc" aria-hidden="true">${xi("agent-doc")}</span>` +
    `<span class="ag-t"><b>${esc(name)}</b><span class="ag-activity"><span class="ag-doing">${esc(about)}</span></span></span>` +
    `<span class="ag-tm"><span class="ag-when">${esc(where)}</span></span></button></li>`;
}

/** The agents a project's threads and automations can run as, under its Automations in the panel. @param {AgentFrameDeps} deps */
export function createAgentsFrame(deps) {
  /** @param {string} view */
  const mine = (view) => {
    const project = deps.projectOf(view);
    return project ? (deps.personas.seen(project)?.agents ?? []).filter((a) => !a.shadowed).sort(byLevel) : [];
  };
  return {
    id: "personas", title: "Agents",
    /** @param {HTMLElement} host */
    mount(host) {
      /** @param {Event} e */
      const onClick = (e) => {
        const row = e.target instanceof Element ? e.target.closest("[data-ag-act=open]") : null;
        const key = row?.getAttribute("data-ag-key");
        if (key) deps.open(key);
      };
      host.addEventListener("click", onClick);
      const unwatch = deps.personas.watch(() => deps.changed());
      return {
        /** @param {string} view */
        count: (view) => mine(view).length,
        /** @param {string} view */
        paint(view) { redraw(host, `<ul class="ag-list">${mine(view).map(rowHtml).join("")}</ul>`); },
        /** @param {string} view */
        create(view) { deps.create(deps.projectOf(view) ?? ""); },
        dispose() { unwatch(); host.removeEventListener("click", onClick); },
      };
    },
  };
}
