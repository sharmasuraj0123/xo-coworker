// @ts-check
import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { connLine } from "../../core/services/world/conn.js";
import { ICON } from "../../core/ui/icons/names.js";
import { redraw } from "../../core/ui/redraw.js";
import { usable } from "../../core/ui/a11y/focus.js";

/** @import { Notice } from "../../core/services/notices.js" */
/** @import { Composer } from "./composer-types.d.ts" */

/** @typedef {{ S: { view: string; herald: Notice | null }; world: { state: Parameters<typeof connLine>[0] }; MK: Composer; composerNow(): Composer; panelHost(): HTMLElement | null; convThread(view: string): unknown; connDest(): Parameters<typeof connLine>[1]; placeRegion(): HTMLElement | null; STOP_ICON: string }} NoticeLineDeps */

/** @param {NoticeLineDeps} deps */
export function createNoticeLine({ S, world, MK, composerNow, panelHost, connDest, placeRegion, STOP_ICON }) {
  /** @type {WeakMap<HTMLElement, Notice | null>} */
  const lines = new WeakMap();
  const heraldBox = () => (composerNow() === MK ? $("#herald") : $("#tpherald"));
  /** @param {unknown} needs */
  function heraldRender(needs) {
    const box = heraldBox();
    for (const o of [$("#herald"), $("#tpherald")]) if (o && o !== box && o.firstChild) {
      if (o.contains(document.activeElement)) heraldBack(lines.get(o))?.focus({ preventScroll: true });
      redraw(o, ""); lines.delete(o);
    }
    const h = S.herald && S.herald.until > Date.now() ? S.herald : null;
    const c = h ? null : connLine(world.state, box === $("#herald") ? connDest() : { thread: true });
    let html;
    if (h) {
      const ic = h.kind === "stopped" ? `<span class="hr-ic k-stopped">${ICON.close}</span>` : h.kind === "sent" ? `<i class="dash" aria-hidden="true"></i>` : h.kind === "ping" ? `<span class="hr-ic k-ping"><i class="hr-dot"></i></span>` : h.kind === "calm" || h.kind === "halt" ? `<span class="hr-ic k-calm">${h.kind === "halt" ? STOP_ICON : ICON.pause}</span>` : h.kind === "rec" ? `<span class="hr-ic k-calm">${ICON.router}</span>` : `<span class="hr-ic k-ok">${ICON.check}</span>`;
      const inner = `${ic}<span class="hr-t">${esc(h.text)}</span>${h.sub ? `<span class="hr-s">${esc(h.sub)}</span>` : ""}${h.open ? `<span class="hr-go">Open ${ICON.arrow}</span>` : h.decide ? `<span class="hr-go">Look ${ICON.arrow}</span>` : ""}`;
      html = h.open ? `<button type="button" class="hr hr-ev k-${h.kind}" data-go="${esc(h.open)}" data-hn="${h.n}">${inner}</button>`
        : h.decide ? `<button type="button" class="hr hr-ev k-${h.kind}" data-decide="${esc(h.decide)}" data-hn="${h.n}">${inner}</button>`
        : h.undo ? `<div class="hr hr-ev has-undo k-${h.kind}" data-hn="${h.n}">${inner}<button type="button" class="hr-undo" data-herald-undo>${esc(h.undoLabel || "Undo")}</button></div>`
        : `<div class="hr hr-ev k-${h.kind}" data-hn="${h.n}">${inner}</div>`;
    } else if (c) {
      html = `<div class="hr hr-conn k-${c.kind}" role="status"><span class="hr-ic ${c.kind === "down" ? "k-stopped" : "k-calm"}">${c.kind === "down" ? ICON.retry : ICON.pause}</span><span class="hr-t">${esc(c.text)}</span><span class="hr-s">${esc(c.sub)}</span></div>`;
    } else html = "";
    const was = lines.has(box);
    const fa = document.activeElement;
    if (fa && fa !== box && box.contains(fa) && !(h && fa.closest(`[data-hn="${h.n}"]`))) heraldBack(lines.get(box))?.focus({ preventScroll: true });
    if (redraw(box, html) && was && html) box.firstElementChild?.classList.add("is-in");
    lines.set(box, h);
    heraldRoom();
  }
  function heraldRoom() {
    for (const [box, dock, host] of [[$("#herald"), $("#dock"), $("#app")], [$("#tpherald"), $("#tpdock"), panelHost()]]) {
      if (!box) continue;
      const line = box.firstElementChild;
      const shown = line && line.getClientRects().length > 0;
      const px = shown ? Math.max(0, Math.round(dock.getBoundingClientRect().top - box.getBoundingClientRect().top)) : 0;
      const v = px ? `${px + 8}px` : "0px";
      if (host.style.getPropertyValue("--herald-room") !== v) host.style.setProperty("--herald-room", v);
    }
  }
  /** @param {(Notice & {back?: (string | (() => HTMLElement | null))[]}) | null | undefined} h */
  function heraldBack(h) { return [...((h && h.back) || []).map((sel) => (typeof sel === "function" ? sel() : $(sel))), composerNow().say].find(usable) || placeRegion(); }

  return { heraldBox, heraldRender, heraldRoom, heraldBack };
}
