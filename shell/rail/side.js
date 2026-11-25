// @ts-check

// The sidebar: folded, a rail of the same rows with their words hidden; its bar is yours to edit, and More holds the rest.

import * as keys from "../../core/platform/keys.js";
import { $, $$, findHtml, isHtml, requireHtml } from "../../core/platform/dom.js";
import { reportFailure } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";
import { esc } from "../../core/platform/index.js";
import { BAR, FOLD, PINS, barValue, clearLegacy, hasLegacy, placeIds, readFold, readLegacy, writeFold } from "./side-storage.js";
import { redraw } from "../../core/ui/redraw.js";
import { focusOpened } from "../../core/ui/a11y/keynav.js";
import { listenSide } from "./side-events.js";

/** @import { SideDeps, Place, Side } from "./side-types.d.ts" */

/** The sidebar's fold, bar and More, wired to its markup in index.html. @param {SideDeps} deps */
export function createSide({ shape: SHAPE, keys: K = keys, announce, render, toggleJump, scope }) {
  let popHtml = "";
  /** @type {Side} */
  const SIDE = {
    KEY: FOLD, PINS,
    folded: readFold(),
    fold(on, { quiet = false } = {}) {
      SIDE.folded = !!on;
      writeFold(on);
      const app = requireHtml("#app");
      app.classList.toggle("side-folded", SIDE.folded);
      app.classList.remove("side-peeking");
      const peekButton = requireHtml("[data-side-peek]", "button");
      peekButton.setAttribute("aria-expanded", "false");
      const b = requireHtml("#side-fold", "button");
      b.setAttribute("aria-expanded", String(!SIDE.folded));
      b.innerHTML = SIDE.folded ? ICON.pin : ICON.sidebar;
      b.setAttribute("aria-label", SIDE.folded ? "Pin the sidebar" : "Fold the sidebar");
      b.title = `${b.getAttribute("aria-label")}${K.hint("sideFold")}`;
      if (!quiet) (SIDE.folded ? peekButton : b).focus({ preventScroll: true });
      requireHtml("#side-jump", "button").title = `Search and jump${K.hint("jump")}`;
      // the places' names become their tooltips while the words are hidden
      for (const r of $$("#side .nav .nrow").filter(isHtml)) { const n = r.querySelector(".nr-name")?.textContent || ""; if (SIDE.folded) r.title = n; else r.removeAttribute("title"); }
      SIDE.closeMore();
      if (!quiet) { announce(SIDE.folded ? "Sidebar folded" : "Sidebar shown"); render(); }
    },
    // the bar: every place in your order, the kept ones as rows, the rest in More; kept in your shape (layout.side)
    BAR,
    CORE: [
      { id: "home", name: "Home", sel: "#nv-home" },
      { id: "ws", name: "All projects", sel: "#nv-ws" },
      { id: "chats", name: "New chat", sel: "#nv-chats" },
      { id: "arts", name: "Artifacts", sel: "#nv-arts" },
    ],
    PLACES: [
      { id: "launchpad", name: "Launchpad", sel: "#nv-lp" },
      { id: "runtimes", name: "Runtimes", ic: () => ICON.runtime },
      { set: true, id: "accounts", name: "Accounts", ic: () => ICON.person },
      { set: true, id: "routing", name: "Routing", ic: () => ICON.router },
      { set: true, id: "rules", name: "Rules", ic: () => ICON.rule },
      { set: true, id: "worktrees", name: "Worktrees", ic: () => ICON.branch },
      { set: true, id: "keys", name: "Keyboard", ic: () => ICON.key },
    ],
    all() { return [...SIDE.CORE, ...SIDE.PLACES]; },
    byId(id) {
      const place = SIDE.all().find((p) => p.id === id);
      if (!place) throw new Error(`Unknown sidebar place: ${id}`);
      return place;
    },
    /** {order, shown}: what you saved, made whole (a new place joins at the end, hidden; a gone one is dropped); else More's old pins. */
    bar() {
      const ids = SIDE.all().map((p) => p.id), def = { order: ids, shown: SIDE.CORE.map((p) => p.id) };
      const v = barValue(SHAPE.get("layout")?.side ?? readLegacy(SIDE.BAR));
      if (!v) {
        const pins = placeIds(readLegacy(SIDE.PINS));
        return { order: def.order, shown: [...def.shown, ...pins.filter((x) => ids.includes(x))] };
      }
      const order = [...v.order.filter((x) => ids.includes(x)), ...ids.filter((x) => !v.order.includes(x))];
      return { order: [...new Set(order)], shown: v.shown.filter((x) => ids.includes(x)) };
    },
    save(b) { SHAPE.patchMine({ layout: { side: { order: b.order, shown: b.shown } } }); clearLegacy(); SIDE.apply(); },
    isDefault(b = SIDE.bar()) { const d = SIDE.all().map((p) => p.id); return b.order.join() === d.join() && b.shown.join() === SIDE.CORE.map((p) => p.id).join(); },
    reset() { SHAPE.patchMine({ layout: { side: null } }); clearLegacy(); SIDE.apply(); },
    /** What this browser kept before the bar lived in your shape (its own key, or More's pins): moved there once. */
    adopt() {
      if (SHAPE.get("layout")?.side != null) return;
      if (hasLegacy() && !SIDE.isDefault()) SIDE.save(SIDE.bar());
    },
    /** Keep a place in the bar, or send it to More (More's pin, the editor's switch). */
    pin(id, on) {
      const b = SIDE.bar();
      b.shown = b.shown.filter((x) => x !== id);
      if (on) b.shown.push(id);
      SIDE.save(b);
    },
    /** Move a place one step (dir −1 / +1), or to before another (the editor's drag). */
    move(id, dir, before = null) {
      const b = SIDE.bar(), o = b.order.filter((x) => x !== id);
      let at = before != null ? (before === "" ? o.length : o.indexOf(before)) : Math.max(0, Math.min(o.length, b.order.indexOf(id) + dir));
      if (at < 0) at = o.length;
      o.splice(at, 0, id);
      b.order = o;
      SIDE.save(b);
    },
    extras: new Map(), // a Settings page kept in the bar: its row, made once
    /** The sidebar's rows, as the bar says: the four places are the page's own rows, Settings' pages rows made for them; all before More. */
    apply() {
      const b = SIDE.bar(), nav = requireHtml("#side .nav"), more = requireHtml("#nv-more", "button");
      for (const p of SIDE.PLACES) if (!b.shown.includes(p.id)) SIDE.extras.get(p.id)?.remove();
      for (const id of b.order) {
        const p = SIDE.byId(id), on = b.shown.includes(id);
        let el = p.sel ? findHtml(p.sel) : SIDE.extras.get(id);
        if (!p.sel && on && !el) {
          const t = document.createElement("template");
          t.innerHTML = `<button type="button" class="nrow" data-set-open="${p.id}">` +
            `<span class="nr-ic">${p.ic?.()}</span><span class="nr-name">${esc(p.name)}</span></button>`;
          const row = t.content.firstElementChild;
          if (row instanceof HTMLElement) { el = row; SIDE.extras.set(id, row); }
        }
        if (!el) continue;
        if (p.sel) el.hidden = !on;
        if (id === "ws" || id === "chats") continue;
        if (on || p.sel) { if (el.nextElementSibling !== more || el.parentNode !== nav) nav.insertBefore(el, more); }
        if (on && SIDE.folded) el.title = p.name;
      }
      requireHtml("#nv-home").after(requireHtml("#side-jump"));
      if (!requireHtml("#side-more").hidden) SIDE.drawMore();
    },
    /** More: the places you didn't keep, each with its pin, and "Edit the sidebar…"; or, editing, every place with its switch and grip. */
    drawMore() {
      const b = SIDE.bar(), pop = requireHtml("#side-more");
      const icon = (/** @type {Place} */ p) => (p.ic ? p.ic() : $(/** @type {string} */ (p.sel))?.querySelector(".nr-ic")?.innerHTML || "");
      let html;
      if (SIDE.editing) {
        pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Edit the sidebar");
        html = `<div class="se-h"><b>Edit the sidebar</b><span>Keep a place in the bar, or leave it in More. Drag to reorder, or ↑ ↓ on its grip.</span></div><ul class="se-list">` +
          b.order.map((id) => { const p = SIDE.byId(id), on = b.shown.includes(id);
            return `<li class="se-row${on ? "" : " is-off"}" data-se="${id}" draggable="true">` +
              `<button type="button" class="se-grip" data-se-grip="${id}" aria-label="Move ${esc(p.name)}: up or down arrow" title="Drag, or ↑ ↓">${xi("drag-handle")}</button>` +
              `<span class="nr-ic">${icon(p)}</span><span class="nr-name">${esc(p.name)}</span>` +
              `<button type="button" class="switch se-sw" role="switch" data-se-sw="${id}" aria-checked="${on}" aria-label="Keep ${esc(p.name)} in the sidebar"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></li>`; }).join("") +
          `</ul><div class="se-f"><button type="button" class="btn" data-se-reset${SIDE.isDefault(b) ? " disabled" : ""}>Reset to default</button><button type="button" class="btn btn-pri" data-se-done>Done</button></div>`;
      } else {
        pop.setAttribute("role", "menu"); pop.setAttribute("aria-label", "More places");
        const rest = b.order.filter((id) => !b.shown.includes(id)).map((id) => SIDE.byId(id)).filter((p) => !p.set);
        html = rest.map((p) => {
          const go = p.sel ? `data-go="${requireHtml(p.sel).dataset.go}"` : `data-set-open="${p.id}"`;
          return `<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" ${go}><span class="nr-ic">${icon(p)}</span><span class="nr-name">${esc(p.name)}</span></button>` +
            `<button type="button" class="sm-pin" data-side-pin="${p.id}" aria-pressed="false" title="Keep in the sidebar" aria-label="Keep ${esc(p.name)} in the sidebar">${ICON.pin}</button></div>`; }).join("") +
          `${rest.length ? `<div class="sm-sep" role="separator"></div>` : ""}<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" data-side-edit><span class="nr-ic">${ICON.edit}</span><span class="nr-name">Edit the sidebar…</span></button></div>`;
      }
      if (popHtml !== html) { redraw(pop, html); popHtml = html; }
    },
    editing: false,
    edit(on) {
      SIDE.editing = !!on; SIDE.drawMore();
      const pop = requireHtml("#side-more");
      findHtml(on ? "[data-se-grip]" : '[role="menuitem"]', undefined, pop)?.focus({ preventScroll: true });
    },
    openMore(e) {
      const pop = requireHtml("#side-more"), row = requireHtml("#nv-more", "button");
      SIDE.drawMore();
      pop.hidden = false;
      row.setAttribute("aria-expanded", "true"); row.classList.add("is-on");
      // it springs from its row: beside it, level with it
      const r = row.getBoundingClientRect();
      pop.style.setProperty("--pop-x", `${Math.round(r.right)}px`); pop.style.setProperty("--pop-y", `${Math.round(r.top)}px`);
      focusOpened(pop, e);
    },
    closeMore({ focus = false } = {}) {
      const pop = findHtml("#side-more");
      if (!pop || pop.hidden) return;
      const row = requireHtml("#nv-more", "button");
      pop.hidden = true; SIDE.editing = false;
      row.setAttribute("aria-expanded", "false"); row.classList.remove("is-on");
      if (focus) row.focus({ preventScroll: true });
    },
  };
  scope.effect(() => () => {
    const pop = requireHtml("#side-more"), more = requireHtml("#nv-more", "button");
    const focused = document.activeElement;
    SIDE.closeMore({ focus: pop.contains(focused) });
    for (const row of SIDE.extras.values()) {
      if (row.contains(focused)) more.focus({ preventScroll: true });
      row.remove();
    }
    SIDE.extras.clear();
    pop.replaceChildren();
  });
  listenSide({ scope, side: SIDE, announce, toggleJump });
  SIDE.apply();
  SHAPE.synced.then(() => {
    if (scope.signal.aborted) return;
    SIDE.adopt();
    SIDE.apply();
  }).catch((error) => { if (!scope.signal.aborted) reportFailure(error); });
  scope.effect(() => SHAPE.onChange(SIDE.apply));
  return SIDE;
}
