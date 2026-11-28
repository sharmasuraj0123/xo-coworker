// @ts-check
import { findHtml } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { connLine } from "../../core/services/world/conn.js";
import { ICON } from "../../core/ui/icons/names.js";
import { redraw } from "../../core/ui/redraw.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { undoRingHtml, startUndoRings } from "../../core/ui/undo-ring.js";
/** @import { Notice } from "../../core/services/notices.js" */

/** @import { NoticeLineDeps } from "./notice-line-types.d.ts" */

/** @param {NoticeLineDeps} deps */
export function createNoticeLine({ notice, world, MK, composerNow, panelHost, connDest, placeRegion }) {
  /** @type {WeakMap<HTMLElement, { notice: Notice | null, html: string }>} */
  const lines = new WeakMap();
  const heraldBox = () => (composerNow() === MK ? findHtml("#herald") : findHtml("#tpherald"));
  /** @param {unknown} needs */
  function heraldRender(needs) {
    const box = heraldBox();
    for (const o of [findHtml("#herald"), findHtml("#tpherald")]) if (o && o !== box && o.firstChild) {
      if (o.contains(document.activeElement)) heraldBack(lines.get(o)?.notice)?.focus({ preventScroll: true });
      redraw(o, ""); lines.delete(o);
    }
    const current = notice();
    const h = current && current.until > Date.now() ? current : null;
    const c = h ? null : connLine(world.state, connDest(composerNow().view));
    let html;
    if (h) {
      const ic = h.kind === "stopped" ? `<span class="hr-ic k-stopped">${ICON.close}</span>` : h.kind === "sent" ? `<i class="dash" aria-hidden="true"></i>` : h.kind === "ping" ? `<span class="hr-ic k-ping"><i class="hr-dot"></i></span>` : h.kind === "calm" || h.kind === "halt" ? `<span class="hr-ic k-calm">${h.kind === "halt" ? ICON.stop : ICON.pause}</span>` : h.kind === "rec" ? `<span class="hr-ic k-calm">${ICON.router}</span>` : `<span class="hr-ic k-ok">${ICON.check}</span>`;
      const inner = `${ic}<span class="hr-t">${esc(h.text)}</span>${h.sub ? `<span class="hr-s">${esc(h.sub)}</span>` : ""}${h.open ? `<span class="hr-go">Open ${ICON.arrow}</span>` : h.decide ? `<span class="hr-go">Look ${ICON.arrow}</span>` : ""}`;
      html = h.open ? `<button type="button" class="hr hr-ev k-${h.kind}" data-go="${esc(h.open)}" data-hn="${h.n}">${inner}</button>`
        : h.decide ? `<button type="button" class="hr hr-ev k-${h.kind}" data-decide="${esc(h.decide)}" data-hn="${h.n}">${inner}</button>`
        : h.details ? `<div class="hr hr-ev k-halt">${inner}<button type="button" class="hr-undo" data-key="failure-details" ` +
          `data-failure-details="${esc(h.details)}" aria-haspopup="dialog">Details</button></div>`
        : h.undo ? `<div class="hr hr-ev has-undo k-${h.kind}" data-hn="${h.n}">${inner}<button type="button" class="hr-undo" data-herald-undo>${h.undoUntil ? undoRingHtml(h.undoUntil, h.undoMs) : ""}${esc(h.undoLabel || "Undo")}</button></div>`
        : `<div class="hr hr-ev k-${h.kind}" data-hn="${h.n}">${inner}</div>`;
    } else if (c) {
      html = `<div class="hr hr-conn k-${c.kind}" role="status"><span class="hr-ic ${c.kind === "down" ? "k-stopped" : "k-calm"}">${c.kind === "down" ? ICON.retry : ICON.pause}</span><span class="hr-t">${esc(c.text)}</span><span class="hr-s">${esc(c.sub)}</span></div>`;
    } else html = "";
    if (!box) return;
    const prior = lines.get(box);
    const fa = document.activeElement;
    const readingFailure = h?.details && fa?.matches("[data-failure-details]");
    if (!readingFailure && fa && fa !== box && box.contains(fa) && !(h && fa.closest(`[data-hn="${h.n}"]`))) heraldBack(prior?.notice)?.focus({ preventScroll: true });
    if (prior?.html !== html && redraw(box, html) && prior && html) box.firstElementChild?.classList.add("is-in");
    lines.set(box, { notice: h, html });
    startUndoRings(box);
    heraldRoom();
  }
  function heraldRoom() {
    const hosts = [
      [findHtml("#herald"), findHtml("#dock"), findHtml("#app")],
      [findHtml("#tpherald"), findHtml("#tpdock"), panelHost()],
    ];
    for (const [box, dock, host] of hosts) {
      if (!box || !dock || !host) continue;
      const line = box.firstElementChild;
      const shown = line && line.getClientRects().length > 0;
      const px = shown ? Math.max(0, Math.round(dock.getBoundingClientRect().top - box.getBoundingClientRect().top)) : 0;
      const v = px ? `${px + 8}px` : "0px";
      if (host.style.getPropertyValue("--herald-room") !== v) host.style.setProperty("--herald-room", v);
    }
  }
  /** @param {(Notice & {back?: (string | (() => HTMLElement | null))[]}) | null | undefined} h */
  function heraldBack(h) { return [...((h && h.back) || []).map((sel) => (typeof sel === "function" ? sel() : findHtml(sel))), composerNow().say].find(usable) || placeRegion(); }

  /** @param {import("./notice-line-types").NoticeUndo} actions */
  function undoNotice({ requestFocus, undo, undoRecord }) {
    const h = notice(), u = h?.undo;
    if (!h?.ownFocus) {
      heraldBack(h)?.focus({ preventScroll: true });
      const K = composerNow();
      requestFocus([...((h && h.back) || []), () => K.say]);
    }
    if (typeof u === "function") undo();
    else if (u) undoRecord(u);
  }
  return { heraldBox, heraldRender, heraldRoom, undoNotice };
}
