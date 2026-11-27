// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { esc } from "../../core/platform/index.js";
import { missingRoute } from "../../core/platform/http.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { count, plural } from "../../core/platform/words.js";
import { closeDialog, createDialog } from "../../core/ui/components/dialog.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import { catchUp, sinceWord } from "./model.js";
import { createVisits } from "./visits.js";

/** @import {SinceNeed, SinceOptions, Thread} from "./model-types" */

const DOT = '<span class="sl-sep" aria-hidden="true"> · </span>';
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

/** @param {ReturnType<typeof catchUp>} catchup */
function partsText(catchup) {
  return catchup.groups.map(({ items, label, tone }) =>
    `<span class="sl-n t-${tone}">${items.length} ${esc(label.toLowerCase())}</span>`).join(DOT);
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
  /** @type {WeakMap<HTMLElement, string>} */
  const rendered = new WeakMap();

  /** @param {string} project */
  function threadsIn(project) {
    const threads = /** @type {(Thread & {project?: string})[]} */ (world.state.threads);
    return threads.filter((thread) => thread.project === project);
  }

  /** @param {string | null} pid @param {SinceNeed[]} needs @param {HTMLElement | null} box */
  function sinceLine(pid, needs, box = document.getElementById("since")) {
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
    const items = catchUp(threadsIn(pid), { since, needing: needingSet(needs) });
    if (!items.total) return "";
    return `<p class="sl" role="status">${ICON.clock}<span class="sl-k">${sinceLabel(since)}</span>`
      + `${partsHtml(items)}${dismissButton(place)}</p>`;
  }

  /** @type {{ since: number, rows: { at: number, html: string }[], needs: number } | null} */
  let home = null;
  /** @type {HTMLDialogElement | null} */
  let sheet = null;

  /** @param {SinceNeed[]} needs */
  function homeSinceLines(needs) {
    const since = visits.arrive("home");
    home = since == null ? null : homeRows(since, needingSet(needs));
    if (!home) { if (sheet) closeDialog(sheet); return ""; }
    if (sheet?.open) redraw(sheet, sheetHtml(home));
    const { needs: waiting, rows } = home;
    const ask = waiting ? `<span class="sl-n t-amber">${waiting} ${plural(waiting, "needs", "need")} you</span>${DOT}` : "";
    return '<section class="sl-home" aria-label="Since you were away">'
      + `<button type="button" class="sl-open" data-since-open aria-haspopup="dialog">${ICON.clock}`
      + `<span class="sl-open-k">${sinceLabel(since)}</span>`
      + `<span class="sl-open-n">${ask}${count(rows.length, "project")}</span>${ICON.right}</button></section>`;
  }

  /** @param {number} since @param {Set<string>} needing */
  function homeRows(since, needing) {
    /** @type {{ at: number, html: string }[]} */
    const rows = [];
    let waiting = 0;
    for (const project of world.state.projects || []) {
      if (!project || project.id === "workspace") continue;
      const items = catchUp(threadsIn(project.id), { since, needing });
      if (!items.total) continue;
      waiting += items.counts.needs ?? 0;
      const at = Math.max(...items.groups.map((group) => group.items[0].t.lastAt));
      const name = `<span class="sl-row-p">${esc(project.name || project.id)}</span>`;
      rows.push({ at, html: `<li><button type="button" class="sl-row" data-go="p:${esc(project.id)}"><span class="sl-row-t">`
        + `${name}<span class="sl-row-s">${partsText(items)}</span></span>${ICON.right}</button></li>` });
    }
    if (!rows.length) return null;
    rows.sort((a, b) => b.at - a.at);
    return { since, rows, needs: waiting };
  }

  /** @param {NonNullable<typeof home>} at */
  function sheetHtml({ since, rows, needs }) {
    const sub = count(rows.length, "project") + (needs ? ` · ${needs} ${plural(needs, "needs", "need")} you` : "");
    return `<header class="sl-sh"><div class="sl-sh-t"><h2 id="sl-h">${sinceLabel(since)}</h2><p>${sub}</p></div>`
      + `<button type="button" class="sl-sx" data-sl-close aria-label="Close" title="Close">${ICON.close}</button></header>`
      + `<ul class="sl-list">${rows.map(({ html }) => html).join("")}</ul>`
      + '<footer class="sl-sf"><button type="button" class="sl-seen" data-rec-got="home">Mark all as seen</button></footer>';
  }

  function openSheet() {
    if (!home) return;
    if (!sheet) {
      const d = sheet = /** @type {HTMLDialogElement} */ (createDialog());
      d.classList.add("sl-sheet");
      d.setAttribute("aria-labelledby", "sl-h");
      document.body.appendChild(d);
      scope.listen(d, "click", (event) => {
        const target = event.target;
        if (target === d || (target instanceof Element && target.closest("[data-sl-close],[data-go]"))) closeDialog(d);
      });
      scope.listen(d, "close", () => {
        const at = document.activeElement;
        if (at && at !== document.body && !d.contains(at)) return;
        const back = document.querySelector("[data-since-open]") ?? document.getElementById("home");
        if (back instanceof HTMLElement) back.focus({ preventScroll: true });
      });
      scope.effect(() => () => d.remove());
    }
    redraw(sheet, sheetHtml(home));
    sheet.classList.remove("is-closing");
    if (!sheet.open) sheet.showModal();
  }

  scope.listen(document, "click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-since-open]")) { openSheet(); return; }
    const got = event.target.closest("[data-rec-got]");
    const place = got?.getAttribute("data-rec-got");
    if (!got || !place) return;
    if (got.contains(document.activeElement)) {
      document.getElementById(place === "home" ? "home" : "scroller")?.focus({ preventScroll: true });
    }
    if (place === "home" && sheet) closeDialog(sheet);
    visits.dismiss(place);
    announce("Caught up");
    schedule();
  });

  return {
    placeOf: visits.placeOf,
    markCurrent: visits.markCurrent,
    leave: visits.leave,
    sinceLine,
    homeSinceLines,
    /** @param {() => string | null} view */
    set view(view) { visits.setView(view); },
    dispose: scope.dispose,
  };
}
