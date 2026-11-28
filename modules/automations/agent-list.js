// @ts-check

import { esc } from "../../core/platform/util.js";
import { once } from "../../core/platform/pending.js";
import { xi } from "../../core/ui/icons/icon.js";
import { titleOf } from "./agent-file.js";
import { agentGroupHtml, importHtml } from "./agent-views.js";
import { emptyHtml } from "./views.js";

/** @import { Importable } from "../../core/platform/persona-response-types" */

/** @import { AgentListDeps } from "./types" */

const EMPTY = "An agent is a role a thread or an automation runs as: its instructions, what it may do and where it runs.";

/** The Agents tab: the Space's agents, then each project's own, and bringing in Claude Code's. @param {AgentListDeps} deps */
export function createAgentList(deps) {
  /** @type {Importable[] | null} */
  let importable = null;
  let importing = false, asked = false;
  const unwatch = deps.personas.watch(() => { if (deps.shown()) deps.changed(); });

  async function readImportable() {
    asked = true;
    try { importable = await deps.personas.importable(""); } catch (error) { importable = []; deps.failed(error, ""); }
    deps.changed();
  }

  function listHtml() {
    const { space, own } = deps.personas.everywhere(deps.projects().map((p) => p.id));
    if (!space) return `<p class="au-none">Reading your agents…</p>`;
    if (!asked) void readImportable();
    const bring = importable?.length ? `<button type="button" class="au-link au-bring" data-ag-act="bring">${xi("download")}` +
      `<span>${esc(`Bring in your Claude Code agents (${importable.length})`)}</span>${xi("chevron-right")}</button>` : "";
    const on = deps.selected(), menu = deps.menu();
    const groups = agentGroupHtml("Every project", space.agents, on, menu) + own.map(({ id, list }) =>
      agentGroupHtml(deps.projectName(id), (list?.agents ?? []).filter((a) => a.level === "project"), on, menu)).join("");
    const failed = space.failed ? `<div class="au-empty"><b>Couldn't read your agents.</b>` +
      `<button type="button" class="btn" data-ag-act="reload">Try again</button></div>` : "";
    return bring + (groups || failed || emptyHtml("No agents yet", EMPTY));
  }

  return {
    html() {
      if (!importing) return listHtml();
      return `<button type="button" class="au-back" data-ag-act="bring-done">${xi("chevron-left")}Agents</button>` +
        `<h2 class="au-day">From Claude Code</h2>` +
        `<p class="au-note">Each comes in as a copy you can change; settings XO can't map stay out.</p>` +
        importHtml(importable, "ag-imp");
    },
    /** @param {Element} target @returns {boolean} */
    onClick(target) {
      const what = target.getAttribute("data-ag-act");
      if (what === "bring") { importing = true; void readImportable(); return true; }
      if (what === "bring-done") { importing = false; return true; }
      if (what === "reload") { void deps.personas.refresh(""); return true; }
      if (what === "import") {
        const i = Number(target.getAttribute("data-ag-i")), item = importable?.[i];
        if (!item) return true;
        void once(`ag-imp:${i}`, async () => {
          try {
            const done = await deps.personas.importOne(item, "", item.dropped.length > 0);
            deps.announce(`${titleOf(done.name)} brought in`);
            await readImportable();
            if (!importable?.length) importing = false;
          } catch (error) { deps.failed(error, `Couldn't bring in ${titleOf(item.name)}.`); }
          deps.changed();
        });
        return true;
      }
      return false;
    },
    get importing() { return importing; },
    /** Esc: back from bringing in; true when it did. */
    escape() { if (!importing) return false; importing = false; deps.changed(); return true; },
    dispose: unwatch,
  };
}
