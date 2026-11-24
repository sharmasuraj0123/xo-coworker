// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { expand } from "../../core/ui/motion.js";
import { landed } from "../../core/ui/landing.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import { HandledDeps, HandledParts, WorkingThread } from "./handled-types.d.ts" */

/** @param {HandledDeps} options */
export function createHandled({ S, world, homeParts, isBusy, num, PROJ, threadMark, askTitle }) {
  const low = (/** @type {number} */ n) => num(n).toLowerCase();
  const built = new WeakSet();
  /** @param {HandledParts} parts @param {WorkingThread[]} working */
  function endRender(parts, working) {
    const end = $("#hm-end");
    if (!built.has(end)) {
      end.innerHTML = `<section class="handled" id="handled" aria-label="Handled"><div class="hd-row0"><div id="hd-head"></div></div><div class="hd-b" id="hd-b" hidden><div class="hd-in" id="hd-in"></div></div></section>`;
      built.add(end);
    }
    const w = working.length, held = parts.held;
    const bits = [w ? `${low(w)} working` : "nothing running", held.length ? `${low(held.length)} can wait` : ""].filter(Boolean);
    redraw($("#hd-head"), `<button type="button" class="hd" data-fid="hd" data-handled aria-expanded="${S.handledOpen}" aria-controls="hd-b"><span class="hd-ic">${ICON.check}</span><span class="hd-t"><b>Handled</b> · ${bits.join(" · ")}</span>${w || held.length ? ICON.chevron : ""}</button>`);
    landed(end, [...$("#hd-head .hd").children]);
    if (S.handledOpen) redraw($("#hd-in"), handledListHtml(parts, working));
  }

  /** @param {HandledParts} parts @param {WorkingThread[]} working */
  function handledListHtml(parts, working) {
    const rows = working.slice().sort((a, b) => a.project.localeCompare(b.project)).map((t) => {
      const c = t.checklist, cur = c.items.find((i) => i.state === "doing");
      return `<li><button type="button" class="hd-r" data-go="t:${esc(t.id)}"><span class="hd-p">${esc(PROJ(t.project))}</span><span class="hd-tt">${threadMark(t, { lead: true })}${esc(t.title)}</span><span class="hd-now">${cur ? esc(cur.text) : ""}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span></button></li>`;
    }).join("");
    const wait = parts.held.map((n) => `<li class="cw"><span class="cw-main"><span class="cw-t">${askTitle(n)}</span><span class="cw-why">${esc(PROJ(n.t.project))} · ${esc(n.heldWhy)}</span></span><button type="button" class="cw-in" data-bring-in="${esc(n.key)}">Bring in</button></li>`).join("");
    return (rows ? `<ul class="hd-ul">${rows}</ul>` : "") + (wait ? `<h3 class="hd-k">Can wait</h3><ul class="cw-ul">${wait}</ul>` : "");
  }

  /** @param {boolean} open */
  function setHandled(open) {
    S.handledOpen = open;
    if (open) redraw($("#hd-in"), handledListHtml(homeParts(), world.state.threads.filter(isBusy)));
    $("[data-handled]")?.setAttribute("aria-expanded", String(open));
    expand($("#handled"), $("#hd-b"), open);
  }

  return { endRender, setHandled };
}
