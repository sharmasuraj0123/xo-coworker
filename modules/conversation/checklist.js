// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { WAITING } from "../../core/services/world/store.js";
import { stopWords } from "../../core/services/world/conversation.js";
import { ICON, stepMark } from "../../core/ui/icons/names.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import { ChecklistDeps, ChecklistNeed, ChecklistHead } from "./checklist-types.d.ts" */

/** @param {ChecklistDeps} options */
export function createChecklistRenderer({ S, SHAPE, convThread, runsStrip, schedule }) {
  /** @param {ChecklistNeed[]} needs @param {ChecklistHead} [th] */
  return function checklistRender(needs, th = $("#thead"), view = S.view, listId = "ck-list") {
    const t = convThread(view);
    if (!t) { th.hidden = true; th._h = ""; return; }
    const c = t.checklist;
    if (!c.total) {
      const all = runsStrip(t);
      if (th._h !== all) { redraw(th, all); th._h = all; }
      th.hidden = !all;
      return;
    }
    th.hidden = false;
    const open = !!S.ckOpen[t.id];
    const seen = S.ckSeen[t.id];
    if (seen != null && c.done > seen) {
      const doneStep = c.items[c.done - 1];
      S.ckFresh = { tid: t.id, text: doneStep ? doneStep.text : "Step done", until: Date.now() + 1500 };
      setTimeout(schedule, 1560);
    }
    S.ckSeen[t.id] = c.done;
    const fresh = S.ckFresh && S.ckFresh.tid === t.id && S.ckFresh.until > Date.now() ? S.ckFresh : null;
    const n = needs.find((x) => x.t.id === t.id);
    const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
    let mode = "working", nowHtml;
    if (fresh) { mode = "fresh"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>${esc(fresh.text)}</span>`; }
    else if (n && WAITING(t.state)) { mode = "needs"; nowHtml = `<span class="ck-m is-amber">${ICON.needs}</span><span>Paused on you</span>`; }
    else if (t.stop) { mode = "stopped"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>${esc(stopWords(t.stop))}</span>`; }
    else if (t.state === "failed") { mode = "failed"; nowHtml = `<span class="ck-m is-red">${ICON.stop}</span><span>Stopped at “${esc(cur ? cur.text : "a step")}”</span>`; }
    else if (c.done >= c.total) { mode = "done"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>All ${c.total} steps done</span>`; }
    else if (t.state === "resolved") { mode = "done"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>Resolved at ${c.done} of ${c.total}</span>`; }
    else nowHtml = `<span class="ck-m is-blue">${ICON.doing}</span><span>${esc(cur ? cur.text : "Working")}</span>`;
    const segs = c.items.map((i, k) => `<i class="sg s-${i.state}${fresh && k === c.done - 1 ? " is-pop" : ""}"></i>`).join("");
    const list = c.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${esc(i.text)}</span><span class="sr-only">, ${i.state === "doing" ? "in progress" : i.state}</span></li>`).join("");
    const html = `<div class="ckbar m-${mode}${open ? " is-open" : ""}">` +
      `<div class="ck-row"><button type="button" class="ck-tog" data-ck aria-expanded="${open}" aria-controls="${listId}" title="Checklist">` +
      `<span class="ck-segs" aria-hidden="true">${segs}</span><span class="ck-n">${c.done} of ${c.total}</span>` +
      `<span class="ck-now" data-mode="${mode}">${nowHtml}</span>${t.branch && SHAPE.on("xo:thread/branch") ? `<code class="ck-br">${ICON.branch}${esc(t.branch)}</code>` : ""}<span class="ck-chev">${ICON.chevron}</span></button></div>` +
      `<div class="ck-b"><ol class="ck-list" id="${listId}" aria-label="Checklist">${list}</ol></div></div>`;
    const all = html + runsStrip(t);
    if (th._h !== all) { redraw(th, all); th._h = all; }
  };
}
