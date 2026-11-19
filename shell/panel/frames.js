// @ts-check

// The panel's stack of frames: which show, which fold, which grows, their heights and the lines between them.

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";

export const ORDER = ["agents", "changes", "map"];
export const MAP_H = 260, MAP_MIN = 72;
// Threads is sized in whole rows, never a row cut in half: a row and the gap under it are ROW px
export const AG_ROWS = 6, ROW = 48;
// the room Changes needs (its head, one file row, the list's foot, the diff's 120 px and margin) and a frame's head
export const CH_MIN = 212, HEAD = 40;

/** @typedef {{ el: any, S: any, fr: any, LPF: any, frames: () => string[], view: () => string, launch: any, map: any, persist: () => void, paint: () => void, pressDeploy: () => void }} FramesDeps */

/** @param {FramesDeps} P */
export function createFrames({ el, S, fr, LPF, frames, view, launch, map, persist, paint, pressDeploy }) {
  function layout() {
    // the shape's frames: one it doesn't keep is gone, with the line beside it
    const keep = new Set(frames());
    if (!keep.size) keep.add("agents");
    const on = (/** @type {string} */ id) => keep.has(id);
    for (const id of ORDER) {
      el.querySelector(`[data-fr="${id}"]`).hidden = !on(id);
    }
    // Launchpad: there for a project that can deploy; open, it has the stack and the others show their heads
    const lpCan = !!(launch && launch.has(view()));
    if (!lpCan) S.lp = false;
    const lpOn = lpCan && S.lp;
    LPF.hidden = !lpOn;
    el.querySelector("[data-lp-line]").hidden = !lpOn;
    LPF.classList.toggle("is-folded", !S.lp);
    LPF.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(S.lp));
    LPF.querySelector("[data-fr-fold]").title = S.lp ? "Fold" : "Open";
    // classes on the frames themselves, never on the panel: a class on the panel restyled every element in it
    LPF.classList.toggle("is-open", S.lp);
    pressDeploy();
    el.querySelector('[data-gut="agents|changes"]').hidden = !(on("agents") && (on("changes") || on("map")));
    el.querySelector('[data-gut="changes|map"]').hidden = !(on("changes") && on("map"));
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`), folded = !!fr[id].folded;
      // covered by an open Launchpad: aria-hidden and out of the tab order (inert restyled the whole diff)
      if (S.lp) f.setAttribute("aria-hidden", "true"); else f.removeAttribute("aria-hidden");
      untab(f, S.lp);
      f.classList.toggle("is-folded", folded);
      f.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(!folded));
      f.querySelector("[data-fr-fold]").title = folded ? "Open" : "Fold";
    }
    // Changes takes the room that's left, then the Map, else Threads; while Changes is empty, Threads has the room
    const grow = (S.chEmpty ? ["agents", "changes", "map"] : ["changes", "map", "agents"]).find((id) => on(id) && !fr[id].folded);
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`);
      f.classList.toggle("is-grow", grow === id);
      const h = id === "map" ? fr.map.h : null;
      f.style.height = fr[id].folded || grow === id || !h ? "" : `${h}px`;
    }
    capAgents();
    if (fr.map.folded || S.lp || !on("map") || !S.open) map.hide(); else map.show(view());
  }

  /** Threads is as tall as its rows, up to its count of them, and never more than the stack has room for. */
  function capAgents() {
    const keep = new Set(frames()), on = (/** @type {string} */ id) => keep.has(id) || (!keep.size && id === "agents");
    const ag = el.querySelector('[data-fr="agents"]');
    let rows = fr.agents.rows || AG_ROWS, cap = 8;
    // the stack's height comes from its resize observer, never a read here, which forced the page's layout
    const room = S.lp ? 0 : S.stackH - (LPF.hidden ? 0 : HEAD + 1);
    if (room > 0 && on("agents") && !fr.agents.folded && !ag.classList.contains("is-grow")) {
      const grows = (/** @type {string} */ id) => el.querySelector(`[data-fr="${id}"]`).classList.contains("is-grow");
      const changes = !on("changes") ? 0 : fr.changes.folded ? HEAD : CH_MIN;
      const mapH = !on("map") ? 0 : fr.map.folded ? HEAD : grows("map") ? 96 : fr.map.h;
      const lines = [...el.querySelectorAll(".fr-gut")].filter((g) => !g.hidden).length;
      cap = Math.max(1, Math.floor((room - changes - mapH - lines - 44) / ROW));
      rows = Math.min(rows, cap);
    }
    S.agRows = rows; S.agCap = cap;
    ag.style.setProperty("--ag-rows", rows);
  }

  /** Launchpad open is drawn over the frames, whose heads show at its foot: real buttons with a copy of each head's look. */
  function ghosts() {
    const g = LPF.querySelector(".fr-ghosts");
    /** @type {Record<string, string>} */
    const NAME = { changes: "Changes", agents: "Threads", map: "Map" };
    const html = !S.lp ? "" : ORDER.filter((id) => !el.querySelector(`[data-fr="${id}"]`).hidden).map((id) => {
      const f = el.querySelector(`[data-fr="${id}"]`), n = f.querySelector(`[data-fr-n="${id}"]`)?.textContent.trim();
      const look = f.querySelector(":scope > .fr-h").innerHTML
        .replace(/<(\/?)(button|h2)\b/g, "<$1span").replace(/ (id|aria-[a-z]+|title|role|tabindex|type|data-[a-z-]+)="[^"]*"/g, "");
      return `<button type="button" class="fr-ghost" data-ghost="${id}" aria-label="Open ${NAME[id]}${n ? `, ${esc(n)}` : ""}"><span class="fr-ghost-v" aria-hidden="true">${look}</span></button>`;
    }).join("");
    // drawn in place, so a head button you're on stays the same button as its count moves
    if (g._h !== html) { redraw(g, html); g._h = html; LPF.style.setProperty("--ghosts", `${g.children.length * HEAD}px`); }
  }

  // focus landing in a frame Launchpad covers moves on: forward out of the panel, backward to the last of its heads
  el.addEventListener("focusin", (/** @type {any} */ e) => {
    if (!S.lp || LPF.contains(e.target) || !e.target.closest?.(".stg-frames")) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) {
      // the panel is last on the page: past it, Tab comes round to the page's first control
      const next = focusAfter(el) || focusAfter(document.body.firstElementChild, true);
      if (next) next.focus({ preventScroll: true }); else e.target.blur();
    } else (LPF.querySelector(".fr-ghost:last-child") || LPF.querySelector(".fr-b"))?.focus({ preventScroll: true });
  });
  const TABBABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  /** A covered frame's controls out of the tab order while Launchpad covers it, and back as they were after. @param {any} frame @param {boolean} off */
  function untab(frame, off) {
    if (off) {
      for (const x of frame.querySelectorAll(TABBABLE)) if (!x.hasAttribute("data-lp-tab")) { x.setAttribute("data-lp-tab", x.getAttribute("tabindex") ?? ""); x.tabIndex = -1; }
    } else {
      for (const x of frame.querySelectorAll("[data-lp-tab]")) { const was = x.getAttribute("data-lp-tab"); if (was === "") x.removeAttribute("tabindex"); else x.setAttribute("tabindex", was); x.removeAttribute("data-lp-tab"); }
    }
  }

  /** The first control after `node` in the page's order, or from it when `from`; or null. @param {any} node @returns {HTMLElement | null} */
  function focusAfter(node, from = false) {
    const FOCUS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    return /** @type {HTMLElement[]} */ ([...document.querySelectorAll(FOCUS)]).find((x) => (from ? node.contains(x) || (node.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) : !node.contains(x) && (node.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING))
      && !el.contains(x) && x.getClientRects().length && !x.closest("[inert],[hidden],[aria-hidden='true']")) || null;
  }

  // the line between two frames: drag it (or ↑ ↓ on it) to give one of them room
  for (const g of el.querySelectorAll("[data-gut]")) {
    const [a, b] = g.dataset.gut.split("|");
    let acc = 0; // Threads: the drag that isn't a whole row yet
    let past = 0; // how far the pointer went past where the Map stopped growing
    // the frame below the line sizes (dragging down shrinks it); when it's the one growing, the frame above sizes
    const sized = () => (el.querySelector(`[data-fr="${b}"]`).classList.contains("is-grow") ? { id: a, sign: 1 } : { id: b, sign: -1 });
    const mapSizes = () => { const m = el.querySelector('[data-fr="map"]'); return !m.hidden && !fr.map.folded && !m.classList.contains("is-grow"); };
    // the Map grows only into the room Changes can spare with Threads' rows as they are on screen
    const mapTop = () => {
      const shown = (/** @type {string} */ id) => !el.querySelector(`[data-fr="${id}"]`).hidden;
      const room = S.stackH - (LPF.hidden ? 0 : HEAD + 1), lines = [...el.querySelectorAll(".fr-gut")].filter((g) => !g.hidden).length;
      const changes = !shown("changes") ? 0 : fr.changes.folded ? HEAD : CH_MIN;
      const rows = Math.min(S.agRows || 1, Math.max(1, el.querySelectorAll('[data-fr="agents"] .ag-r').length));
      return room - changes - lines - 44 - rows * ROW;
    };
    const sizeMap = (/** @type {number} */ d) => {
      const h = fr.map.h || MAP_H;
      fr.map.h = Math.max(MAP_MIN, Math.min(640, d > 0 ? Math.max(h, Math.min(h + d, mapTop())) : h + d));
    };
    const resize = (/** @type {number} */ dy) => {
      const { id, sign } = sized();
      const f = el.querySelector(`[data-fr="${id}"]`);
      if (id === "agents") {
        // a row at a time, once the drag passes half a row; never taller than its rows or the room left
        let d = sign * dy;
        if (past && Math.sign(d) !== Math.sign(past)) { const back = Math.sign(d) * Math.min(Math.abs(d), Math.abs(past)); past += back; d -= back; if (!d) return; }
        const shown = f.querySelectorAll(".ag-r").length;
        const was = Math.min(S.agRows || AG_ROWS, Math.max(1, shown)), top = Math.max(1, Math.min(8, shown, S.agCap || 8));
        // past that the line goes on moving: the Map under Threads takes the room or gives it
        if (b === "map" && !fr.agents.folded && ((d > 0 && was >= top) || (d < 0 && was <= 1)) && mapSizes()) {
          const t = acc + d;
          if (Math.sign(t) === Math.sign(d)) { acc = 0; const h = fr.map.h || MAP_H; sizeMap(t); past += t - ((fr.map.h || MAP_H) - h); layout(); } else acc = t;
          return;
        }
        acc += d;
        let rows = was;
        while (acc >= ROW / 2 && rows < top) { rows++; acc -= ROW; }
        while (acc <= -ROW / 2 && rows > 1) { rows--; acc += ROW; }
        if (rows !== was) fr.agents.rows = rows;
      } else fr[id].h = Math.max(MAP_MIN, Math.min(640, (fr[id].h || f.getBoundingClientRect().height) + sign * dy));
      fr[id].folded = false;
      layout();
    };
    g.addEventListener("pointerdown", (/** @type {PointerEvent} */ e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      let y0 = e.clientY;
      acc = 0; past = 0;
      document.body.classList.add("stage-vsizing");
      const move = (/** @type {PointerEvent} */ ev) => { resize(ev.clientY - y0); y0 = ev.clientY; };
      const up = () => { g.removeEventListener("pointermove", move); document.body.classList.remove("stage-vsizing"); persist(); };
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up, { once: true });
      g.addEventListener("pointercancel", up, { once: true });
    });
    g.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      acc = 0; past = 0;
      // Threads steps a row; the Map 16 px
      const step = sized().id === "agents" ? ROW : 16;
      resize(e.key === "ArrowDown" ? step : -step);
      persist();
    });
    g.addEventListener("dblclick", () => { fr.agents.rows = null; fr.map.h = MAP_H; layout(); persist(); });
  }

  return { layout, capAgents, ghosts };
}
