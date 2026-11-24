// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { esc } from "../../core/platform/index.js";
import { missingRoute } from "../../core/platform/http.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import { catchUp, sinceWord } from "./model.js";
import { createSinceTrees } from "./trees.js";
import { createVisits } from "./visits.js";

/** @import {SinceNeed, SinceOptions, Thread} from "./model-types" */

const HOME_LIMIT = 5;
const SEPARATOR = '<span class="sl-sep" aria-hidden="true">·</span>';

/** @param {SinceNeed[]} needs */
function needingSet(needs) {
  return new Set(needs.filter((need) => need.admitted && !need.later).map((need) => need.t.id));
}

/** @param {ReturnType<typeof catchUp>} catchup */
function partsHtml(catchup) {
  return catchup.groups.map(({ items, label, tone }) => {
    const title = items.map(({ t }) => t.title).join(" · ");
    return `<button type="button" class="sl-part t-${tone}" data-go="t:${esc(items[0].t.id)}"
      title="${esc(title)}">${items.length} ${esc(label.toLowerCase())}</button>`;
  }).join(SEPARATOR);
}

/** @param {string} place */
function dismissButton(place) {
  return `<button type="button" class="sl-x" data-rec-got="${esc(place)}" aria-label="Got it" title="Got it">${ICON.close}</button>`;
}

/** @param {number} since */
function sinceLabel(since) {
  return `Since ${esc(sinceWord(since))}`;
}

/** @param {SinceOptions} options */
export function createSince({ world, api, schedule, announce, storage }) {
  const scope = createScope();
  /** @param {unknown} error */
  function failed(error) {
    if (!scope.signal.aborted && !missingRoute(error)) reportFailure(error);
  }
  const visits = createVisits(world, api, { scope, changed: schedule, failed, storage });
  const treesFor = createSinceTrees((chat, signal) => api.worktrees(chat, signal), scope.signal, schedule, failed);
  /** @type {WeakMap<HTMLElement, string>} */
  const rendered = new WeakMap();

  /** @param {string} project */
  function threadsIn(project) {
    const threads = /** @type {(Thread & {project?: string})[]} */ (world.state.threads);
    return threads.filter((thread) => thread.project === project);
  }

  /** @param {string | null} pid @param {SinceNeed[]} needs */
  function sinceLine(pid, needs) {
    const box = document.getElementById("since");
    if (!box) return;
    const html = pid ? projectLine(pid, needs) : "";
    box.hidden = !html;
    if (html === (rendered.get(box) ?? "")) return;
    if (html) redraw(box, html);
    else box.replaceChildren();
    rendered.set(box, html);
  }

  /** @param {string} pid @param {SinceNeed[]} needs */
  function projectLine(pid, needs) {
    const place = "p:" + pid;
    const since = visits.arrive(place);
    if (since == null) return "";
    const chat = world.project(pid)?.chatId;
    const trees = chat ? treesFor(chat) : undefined;
    const items = catchUp(threadsIn(pid), { since, needing: needingSet(needs), trees });
    if (!items.total) return "";
    return `<p class="sl" role="status">${ICON.clock}<span class="sl-k">${sinceLabel(since)}</span>`
      + `${partsHtml(items)}${dismissButton(place)}</p>`;
  }

  /** @param {SinceNeed[]} needs */
  function homeSinceLines(needs) {
    const since = visits.arrive("home");
    if (since == null) return "";
    const trees = treesFor();
    const needing = needingSet(needs);
    /** @type {{ at: number, html: string }[]} */
    const rows = [];
    for (const project of world.state.projects || []) {
      if (!project || project.id === "workspace") continue;
      const items = catchUp(threadsIn(project.id), { since, needing, trees });
      if (!items.total) continue;
      const at = Math.max(...items.groups.map((group) => group.items[0].t.lastAt));
      const link = `<button type="button" class="sl-p" data-go="p:${esc(project.id)}">${esc(project.name || project.id)}</button>`;
      rows.push({ at, html: `<p class="sl is-home">${link}${partsHtml(items)}</p>` });
    }
    if (!rows.length) return "";
    rows.sort((a, b) => b.at - a.at);
    return '<section class="sl-home" aria-label="Since you were away">'
      + `<p class="sl-k">${ICON.clock}${sinceLabel(since)}${dismissButton("home")}</p>`
      + rows.slice(0, HOME_LIMIT).map(({ html }) => html).join("") + "</section>";
  }

  scope.listen(document, "click", (event) => {
    if (!(event.target instanceof Element)) return;
    const got = event.target.closest("[data-rec-got]");
    const place = got?.getAttribute("data-rec-got");
    if (!got || !place) return;
    if (got.contains(document.activeElement)) {
      document.getElementById(place === "home" ? "home" : "scroller")?.focus({ preventScroll: true });
    }
    visits.dismiss(place);
    announce("Caught up");
    schedule();
  });

  return {
    placeOf: visits.placeOf,
    leave: visits.leave,
    sinceLine,
    homeSinceLines,
    /** @param {() => string | null} view */
    set view(view) { visits.setView(view); },
    dispose: scope.dispose,
  };
}
