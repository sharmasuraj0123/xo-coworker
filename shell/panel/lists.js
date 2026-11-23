// @ts-check

// What the panel's frames list: Threads in groups, the agents at work, today's Changes list.

import { ICON } from "../../core/ui/icons/names.js";
import { ARC } from "../../core/ui/icons/icon.js";
import { esc, since } from "../../core/platform/index.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";

const FOLD_IC = ICON.chevron;

/** Waiting and Done show their first few, then "Show N more". @type {Record<string, number>} */
export const SHOW = { needs: Infinity, working: Infinity, waiting: 5, done: 5 };
// past this many threads the filter field shows; it matches the title, the summary and the branch, every word
export const FILTER_AT = 12;
/** @param {any} r @param {string} q */
export const matchesQ = (r, q) => { const s = `${r.title} ${r.sub || ""} ${r.summary || ""} ${r.branch || ""}`.toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); };

/** Threads: groups in one vocabulary, each folding; a row's state is its tile's corner mark. @param {any[]} groups @param {string} q @param {{ folds: Record<string, boolean>, more: Record<string, any> }} o */
export function threadsHtml(groups, q = "", { folds, more: shownMore }) {
  if (q) {
    groups = groups.map((x) => ({ ...x, rows: x.rows.filter((/** @type {any} */ r) => matchesQ(r, q)) })).filter((x) => x.rows.length);
    if (!groups.length) return `<p class="fr-none tg-none">No thread matches “${esc(q)}”. <button type="button" class="tg-clear" data-tg-clear>Clear the filter</button></p>`;
  }
  if (!groups || !groups.length) return `<p class="fr-none">No ${"threads"} here yet.</p>`;
  const g = q ? {} : folds || {}, more = q ? { needs: 1, working: 1, waiting: 1, done: 1 } : shownMore || {};
  /** @param {any} r */
  const row = (r) => {
    const mark = r.state === "working" ? ARC : r.state === "needs" ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : r.state === "done" ? `<i class="ag-wait ag-done">${ICON.check}</i>` : "";
    return `<li><button type="button" class="ag-r${r.state === "working" || r.state === "needs" ? "" : " is-idle"}${r.on ? " is-on" : ""}"${r.on ? ' aria-current="page"' : ""} data-go="${esc(r.go)}" aria-label="${esc(`${r.title}. ${r.word}`)}">` +
      `<span class="ag-ic"${r.color ? ` style="--c:${esc(r.color)}"` : ""} aria-hidden="true">${r.coord ? ICON.project : ICON.threadOne}${mark}</span>` +
      `<span class="ag-t"><b>${esc(r.title)}</b><span class="ag-activity"><span class="ag-doing">${r.subHtml || esc(r.sub || r.word)}</span></span></span>` +
      `<span class="ag-tm"><span class="ag-when">${r.since ? `<span class="elapsed" data-since="${r.since}">${since(r.since)}</span>` : esc(r.at || "")}</span>${r.mark ? `<span class="ag-mk">${r.mark}</span>` : ""}</span></button></li>`;
  };
  return `<ul class="ag-list tg-list">${groups.map((x) => {
    const folded = !!(/** @type {any} */ (g))[x.k], n = x.rows.length, cap = (/** @type {any} */ (more))[x.k] ? Infinity : SHOW[x.k] ?? 5;
    const head = `<li class="tg-h"><button type="button" class="tg-b" data-tg-fold="${x.k}" aria-expanded="${!folded}"><span class="tg-w">${esc(x.word)}</span><span class="fr-n">${n}</span><span class="tg-ch" aria-hidden="true">${FOLD_IC}</span></button></li>`;
    if (folded) return head;
    const shown = x.rows.slice(0, cap);
    return head + shown.map(row).join("") + (n > shown.length ? `<li class="tg-h"><button type="button" class="tg-b tg-more" data-tg-more="${x.k}" aria-expanded="false"><span class="tg-w">Show ${n - shown.length} more</span><span class="tg-ch" aria-hidden="true">${FOLD_IC}</span></button></li>` : "");
  }).join("")}</ul>`;
}

/** The agents at work, where the app gives no thread groups. @param {any[]} list @param {string} v the view on screen */
export function agentsHtml(list, v) {
  if (!list.length) return `<p class="fr-none">No agent is working here right now.</p>`;
  return `<ul class="ag-list">${list.map((a) => `<li><button type="button" class="ag-r${a.busy ? "" : " is-idle"}${a.go === v ? " is-on" : ""}"${a.go === v ? ' aria-current="page"' : ""} data-go="${esc(a.go)}" title="Open ${esc(a.title)}">` +
    `<span class="ag-ic" style="--c:${esc(a.color)}" aria-hidden="true">${ICON.threadOne}${a.waiting ? `<i class="ag-wait">${ICON.pause}</i>` : a.busy ? ARC : ""}</span><span class="ag-t"><b>${esc(a.title)}</b><span class="ag-activity"><span class="ag-doing">${esc(a.doing)}</span></span></span>` +
    `<span class="ag-tm">${a.busy && Number.isFinite(a.since) ? `<span class="elapsed" data-since="${a.since}">${since(a.since)}</span>` : ""}</span></button></li>`).join("")}</ul>`;
}

/** Today's Changes list, where Space has no /changes. @param {any[]} list @param {string} v the view on screen */
export function changesHtml(list, v) {
  if (!list.length) return `<p class="fr-none">${v === "home" || v === "ws" ? "Open a project or thread to see what its agents changed." : "Nothing changed here yet."}</p>`;
  return `<ul class="ch-list">${list.map((x) => {
    const slash = x.path.lastIndexOf("/"), name = x.path.slice(slash + 1), dir = slash >= 0 ? x.path.slice(0, slash) : "";
    return `<li><button type="button" class="ch-r" data-change="${esc(x.rel)}" data-change-project="${esc(x.project)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="ch-i">${fileIcon(x.path)}</span><span class="ch-copy"><span class="ch-n">${esc(name)}</span>${dir ? `<span class="ch-path">${esc(dir)}</span>` : ""}</span><span class="ch-m m-${esc(x.live ? "live" : x.mark)}">${esc(x.live ? "editing" : x.mark)}</span></button></li>`;
  }).join("")}</ul>`;
}
