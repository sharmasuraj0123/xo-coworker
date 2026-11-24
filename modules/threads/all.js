// @ts-check
import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { short } from "../../core/platform/time.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import { AllThread, AllThreadsDeps } from "./all-types.d.ts" */

/** @import { ThreadGroup } from "./groups-types.d.ts" */

/** @param {AllThreadsDeps} options */
export function createAllThreads({ S, world, D, SHAPE, PROJ, convProject, threadState, threadMark, glyphOf, rtTag, STATE_WORDS }) {
  function allRender() {
    const pid = convProject(S.view);
    const q = (/** @type {HTMLInputElement} */ ($("#all-q"))).value.trim().toLowerCase();
    const needs = D.needItems();
    const ts = world.state.threads.filter((t) => t.project === pid);
    /** @param {AllThread} t */
    const cat = (t) => threadState(t, needs);
    const counts = { all: ts.length, needs: 0, working: 0, waiting: 0, done: 0 };
    for (const t of ts) { const c = cat(t); if (counts[c] != null) counts[c]++; }
    allFilterRender(counts);
    $("#all-h").textContent = `All ${SHAPE.word("threads")} · ${PROJ(pid)}`;
    $("#all-h").title = SHAPE.word("threads") === "threads" ? "" : "XO's word: threads";
    $("#all-q").placeholder = `Search ${SHAPE.word("threads")}`;
    let list = ts.filter((t) => { if (!q) return true; const s = `${t.title} ${t.summary || ""} ${t.branch || ""}`.toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); });
    if (S.allFilter !== "all") list = list.filter((t) => cat(t) === S.allFilter);
    const order = { needs: 0, working: 1, waiting: 2, done: 3 };
    list.sort((a, b) => order[cat(a)] - order[cat(b)] || b.lastAt - a.lastAt);
    /** @param {AllThread} t */
    const row = (t) => {
      const c = t.checklist;
      const k = cat(t);
      const mk = threadMark(t);
      return `<li><button type="button" class="ar st-${k}${mk ? " has-mk" : ""}" data-go="t:${esc(t.id)}">${stateMark(k === "needs" ? "needs_reply" : glyphOf(t))}<span class="ar-tl"><span class="ar-t">${esc(t.title)}</span>${t.label ? `<span class="ar-l">${esc(t.label)}</span>` : ""}</span><span class="ar-s">${rtTag(t, "ar")}${STATE_WORDS[k]}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span><span class="ar-a"><span>${esc(short(t.lastAt))}</span>${mk ? `<span class="ar-mk">${mk}</span>` : ""}</span></button></li>`;
    };
    const fold = S.allFilter === "all" && !q;
    const liveL = fold ? list.filter((t) => cat(t) !== "done") : list;
    const done = fold ? list.filter((t) => cat(t) === "done") : [];
    let html = liveL.length ? `<ul class="ar-list">${liveL.map(row).join("")}</ul>` : "";
    if (done.length) html += `<div class="ar-done${S.allDone ? " is-open" : ""}"><button type="button" class="ar-fold" data-all-done aria-expanded="${S.allDone}">${ICON.check}<span><b>${done.length} done</b>${done.some((t) => t.state === "resolved") ? " or resolved" : ""}</span>${ICON.chevron}</button><div class="ar-db"${S.allDone ? "" : " hidden"}><div class="ar-di"><ul class="ar-list">${done.map(row).join("")}</ul></div></div></div>`;
    if (!html) html = `<p class="ar-none">Nothing matches “${esc(q)}”.</p>`;
    redraw($("#all-list"), html);
  }
  const ALL_F = [["all", "All"], ["needs", "Needs you"], ["working", "Working"], ["waiting", "Waiting"], ["done", "Done"]];
  /** @param {Record<ThreadGroup | 'all', number>} counts */
  function allFilterRender(counts) {
    const box = $("#all-f");
    if (box.children.length !== ALL_F.length) box.innerHTML = ALL_F.map(([k, w]) => `<button type="button" role="radio" data-af="${k}">${w}<span></span></button>`).join("");
    for (const b of /** @type {HTMLCollectionOf<HTMLButtonElement>} */ (box.children)) {
      const k = /** @type {ThreadGroup | 'all'} */ (b.dataset.af), on = S.allFilter === k, n = String(counts[k]);
      if (b.getAttribute("aria-checked") !== String(on)) b.setAttribute("aria-checked", String(on));
      if (b.tabIndex !== (on ? 0 : -1)) b.tabIndex = on ? 0 : -1;
      b.disabled = !on && k !== "all" && !counts[k];
      if ((/** @type {Node} */ (b.lastChild)).textContent !== n) (/** @type {Node} */ (b.lastChild)).textContent = n;
    }
  }
  return allRender;
}
