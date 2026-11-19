// @ts-check

// The sidebar: folded, a rail of the same rows with their words hidden; its bar is yours to edit, and More holds the rest.

import { ICON, xi, $, $$ } from "../../js/ui.js";
import { esc } from "../../js/world.js";
import { redraw } from "../../js/redraw.js";

/** @typedef {{ shape: any, keys: { hint: (id: string) => string }, announce: (text: string) => void, render: () => void, toggleJump: () => void }} SideDeps */

/** @typedef {{ id: string, name: string, sel?: string, ic?: () => string }} Place */

/** @typedef {{ order: string[], shown: string[] }} Bar */

/** @typedef {{ KEY: string, PINS: string, BAR: string, folded: boolean, editing: boolean, CORE: Place[], PLACES: Place[], extras: Map<string, any>, fold(on: boolean, o?: { quiet?: boolean }): void, all(): Place[], byId(id: string): any, bar(): Bar, save(b: Bar): void, isDefault(b?: Bar): boolean, reset(): void, adopt(): void, pin(id: string, on: boolean): void, move(id: string, dir: number, before?: string | null): void, apply(): void, drawPins(): void, drawMore(): void, edit(on: boolean): void, openMore(): void, closeMore(o?: { focus?: boolean }): void }} Side */

/** The sidebar's fold, bar and More, wired to its markup in index.html. @param {SideDeps} deps */
export function createSide({ shape: SHAPE, keys: K, announce, render, toggleJump }) {
  /** @type {Side} */
  const SIDE = {
    KEY: "xo-side-folded", PINS: "xo-side-pins",
    folded: (() => { try { return localStorage.getItem("xo-side-folded") === "1"; } catch { return false; } })(),
    fold(on, { quiet = false } = {}) {
      SIDE.folded = !!on;
      try { localStorage.setItem(SIDE.KEY, on ? "1" : "0"); } catch { /* private */ }
      $("#app").classList.toggle("side-folded", SIDE.folded);
      const b = $("#side-fold");
      b.setAttribute("aria-expanded", String(!SIDE.folded));
      b.setAttribute("aria-label", SIDE.folded ? "Show the sidebar" : "Fold the sidebar");
      b.title = `${SIDE.folded ? "Show" : "Fold"} the sidebar${K.hint("sideFold")}`;
      $("#side-jump").title = `Search and jump${K.hint("jump")}`;
      // the places' names become their tooltips while the words are hidden
      for (const r of $$("#side .nav .nrow")) { const n = r.querySelector(".nr-name")?.textContent || ""; if (SIDE.folded) r.title = n; else r.removeAttribute("title"); }
      SIDE.closeMore();
      if (!quiet) { announce(SIDE.folded ? "Sidebar folded" : "Sidebar shown"); render(); }
    },
    // the bar: every place in your order, the kept ones as rows, the rest in More; kept in your shape (layout.side)
    BAR: "xo-side-bar",
    CORE: [
      { id: "home", name: "Home", sel: "#nv-home" },
      { id: "ws", name: "Workspace", sel: "#nv-ws" },
      { id: "chats", name: "Chats", sel: "#nv-chats" },
      { id: "arts", name: "Artifacts", sel: "#nv-arts" },
    ],
    PLACES: [
      { id: "runtimes", name: "Runtimes", ic: () => ICON.runtime },
      { id: "routing", name: "Routing", ic: () => ICON.router },
      { id: "rules", name: "Rules", ic: () => ICON.rule },
      { id: "worktrees", name: "Worktrees", ic: () => ICON.branch },
      { id: "keys", name: "Keyboard", ic: () => ICON.key },
    ],
    all() { return [...SIDE.CORE, ...SIDE.PLACES]; },
    byId(id) { return SIDE.all().find((p) => p.id === id); },
    /** {order, shown}: what you saved, made whole (a new place joins at the end, hidden; a gone one is dropped); else More's old pins. */
    bar() {
      const ids = SIDE.all().map((p) => p.id), def = { order: ids, shown: SIDE.CORE.map((p) => p.id) };
      /** @type {Bar | null} */
      let v = SHAPE.get("layout")?.side ?? null;
      if (v == null) { try { v = JSON.parse(localStorage.getItem(SIDE.BAR) || "null"); } catch { v = null; } }
      if (!v || !Array.isArray(v.order) || !Array.isArray(v.shown)) {
        let pins = [];
        try { pins = JSON.parse(localStorage.getItem(SIDE.PINS) || "[]"); } catch { pins = []; }
        return { order: def.order, shown: [...def.shown, ...(Array.isArray(pins) ? pins.filter((x) => ids.includes(x)) : [])] };
      }
      const order = [...v.order.filter((x) => ids.includes(x)), ...ids.filter((x) => !v.order.includes(x))];
      return { order: [...new Set(order)], shown: v.shown.filter((x) => ids.includes(x)) };
    },
    save(b) { SHAPE.patchMine({ layout: { side: { order: b.order, shown: b.shown } } }); try { localStorage.removeItem(SIDE.BAR); localStorage.removeItem(SIDE.PINS); } catch { /* private */ } SIDE.apply(); },
    isDefault(b = SIDE.bar()) { const d = SIDE.all().map((p) => p.id); return b.order.join() === d.join() && b.shown.join() === SIDE.CORE.map((p) => p.id).join(); },
    reset() { SHAPE.patchMine({ layout: { side: null } }); try { localStorage.removeItem(SIDE.BAR); localStorage.removeItem(SIDE.PINS); } catch { /* private */ } SIDE.apply(); },
    /** What this browser kept before the bar lived in your shape (its own key, or More's pins): moved there once. */
    adopt() {
      if (SHAPE.get("layout")?.side != null) return;
      let had = false;
      try { had = localStorage.getItem(SIDE.BAR) != null || localStorage.getItem(SIDE.PINS) != null; } catch { had = false; }
      if (had && !SIDE.isDefault()) SIDE.save(SIDE.bar());
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
      const b = SIDE.bar(), nav = $("#side .nav"), more = $("#nv-more");
      for (const p of SIDE.PLACES) if (!b.shown.includes(p.id)) SIDE.extras.get(p.id)?.remove();
      for (const id of b.order) {
        const p = SIDE.byId(id), on = b.shown.includes(id);
        let el = p.sel ? $(p.sel) : SIDE.extras.get(id);
        if (!p.sel && on && !el) {
          const t = document.createElement("template");
          t.innerHTML = `<button type="button" class="nrow" data-set-open="${p.id}"><span class="nr-ic">${p.ic()}</span><span class="nr-name">${esc(p.name)}</span></button>`;
          el = t.content.firstElementChild; SIDE.extras.set(id, el);
        }
        if (!el) continue;
        if (p.sel) el.hidden = !on;
        if (on || p.sel) { if (el.nextElementSibling !== more || el.parentNode !== nav) nav.insertBefore(el, more); }
        if (on && SIDE.folded) el.title = p.name;
      }
      if (!$("#side-more").hidden) SIDE.drawMore();
    },
    drawPins() { SIDE.apply(); },
    /** More: the places you didn't keep, each with its pin, and "Edit the sidebar…"; or, editing, every place with its switch and grip. */
    drawMore() {
      const b = SIDE.bar(), pop = $("#side-more");
      const icon = (/** @type {Place} */ p) => (p.ic ? p.ic() : $(p.sel)?.querySelector(".nr-ic")?.innerHTML || "");
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
        const rest = b.order.filter((id) => !b.shown.includes(id)).map((id) => SIDE.byId(id));
        html = rest.map((p) => {
          const go = p.sel ? `data-go="${$(p.sel).dataset.go}"` : `data-set-open="${p.id}"`;
          return `<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" ${go}><span class="nr-ic">${icon(p)}</span><span class="nr-name">${esc(p.name)}</span></button>` +
            `<button type="button" class="sm-pin" data-side-pin="${p.id}" aria-pressed="false" title="Keep in the sidebar" aria-label="Keep ${esc(p.name)} in the sidebar">${ICON.pin}</button></div>`; }).join("") +
          `${rest.length ? `<div class="sm-sep" role="separator"></div>` : ""}<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" data-side-edit><span class="nr-ic">${ICON.edit}</span><span class="nr-name">Edit the sidebar…</span></button></div>`;
      }
      if (pop._h !== html) { redraw(pop, html); pop._h = html; }
    },
    editing: false,
    edit(on) {
      SIDE.editing = !!on; SIDE.drawMore();
      const pop = $("#side-more");
      (on ? pop.querySelector("[data-se-grip]") : pop.querySelector('[role="menuitem"]'))?.focus({ preventScroll: true });
    },
    openMore() {
      const pop = $("#side-more"), row = $("#nv-more");
      SIDE.drawMore();
      pop.hidden = false;
      row.setAttribute("aria-expanded", "true"); row.classList.add("is-on");
      // it springs from its row: beside it, level with it
      const r = row.getBoundingClientRect();
      pop.style.setProperty("--pop-x", `${Math.round(r.right)}px`); pop.style.setProperty("--pop-y", `${Math.round(r.top)}px`);
      pop.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    },
    closeMore({ focus = false } = {}) {
      const pop = $("#side-more"), row = $("#nv-more");
      if (!pop || pop.hidden) return;
      pop.hidden = true; SIDE.editing = false;
      row.setAttribute("aria-expanded", "false"); row.classList.remove("is-on");
      if (focus) row.focus({ preventScroll: true });
    },
  };
  $("#side-fold").addEventListener("click", () => SIDE.fold(!SIDE.folded));
  $("#side-jump").addEventListener("click", toggleJump);
  $("#nv-more").addEventListener("click", () => ($("#side-more").hidden ? SIDE.openMore() : SIDE.closeMore({ focus: true })));
  $("#side-more").addEventListener("click", (/** @type {any} */ e) => {
    const t = e.target, pop = $("#side-more");
    const pin = t.closest("[data-side-pin]");
    if (pin) { const id = pin.dataset.sidePin; SIDE.pin(id, true); announce(`${SIDE.byId(id).name} is in the sidebar`); pop.querySelector('[role="menuitem"]')?.focus({ preventScroll: true }); return; }
    if (t.closest("[data-side-edit]")) { SIDE.edit(true); return; }
    const sw = t.closest("[data-se-sw]");
    if (sw) { const id = sw.dataset.seSw, on = sw.getAttribute("aria-checked") !== "true"; SIDE.pin(id, on); announce(`${SIDE.byId(id).name}: ${on ? "in the sidebar" : "in More"}`); pop.querySelector(`[data-se-sw="${id}"]`)?.focus({ preventScroll: true }); return; }
    if (t.closest("[data-se-reset]")) { SIDE.reset(); announce("The sidebar is back to its default"); pop.querySelector("[data-se-done]")?.focus({ preventScroll: true }); return; }
    if (t.closest("[data-se-done]")) { SIDE.edit(false); return; }
    if (t.closest("[data-set-open],[data-go]")) SIDE.closeMore();
  });
  $("#side-more").addEventListener("keydown", (/** @type {any} */ e) => {
    const grip = e.target.closest?.("[data-se-grip]");
    if (grip && (e.key === "ArrowUp" || e.key === "ArrowDown") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const id = grip.dataset.seGrip;
      SIDE.move(id, e.key === "ArrowUp" ? -1 : 1);
      const b = SIDE.bar();
      announce(`${SIDE.byId(id).name}: ${b.order.indexOf(id) + 1} of ${b.order.length}`);
      $(`#side-more [data-se-grip="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (SIDE.editing) SIDE.edit(false); else SIDE.closeMore({ focus: true }); return; }
    if (SIDE.editing) return;
    const items = $$('#side-more [role="menuitem"]'), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const j = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[j]?.focus({ preventScroll: true }); }
  });
  // the editor's drag: a row dropped on another goes before it (after it, past its middle)
  $("#side-more").addEventListener("dragstart", (/** @type {any} */ e) => { const r = e.target.closest?.(".se-row"); if (!r) return; e.dataTransfer.setData("text/x-xo-place", r.dataset.se); e.dataTransfer.effectAllowed = "move"; r.classList.add("is-drag"); });
  $("#side-more").addEventListener("dragend", (/** @type {any} */ e) => { e.target.closest?.(".se-row")?.classList.remove("is-drag"); $$("#side-more .se-row.is-over").forEach((x) => x.classList.remove("is-over", "is-after")); });
  $("#side-more").addEventListener("dragover", (/** @type {any} */ e) => {
    const r = e.target.closest?.(".se-row"); if (!r) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    const after = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
    $$("#side-more .se-row.is-over").forEach((x) => x !== r && x.classList.remove("is-over", "is-after"));
    r.classList.add("is-over"); r.classList.toggle("is-after", after);
  });
  $("#side-more").addEventListener("drop", (/** @type {any} */ e) => {
    const r = e.target.closest?.(".se-row"), id = e.dataTransfer.getData("text/x-xo-place");
    if (!r || !id || r.dataset.se === id) return;
    e.preventDefault();
    const after = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
    const next = after ? r.nextElementSibling?.dataset.se ?? "" : r.dataset.se;
    if (next !== id) SIDE.move(id, 0, next);
  });
  document.addEventListener("pointerdown", (/** @type {any} */ e) => { if (!$("#side-more").hidden && !e.target.closest("#side-more,#nv-more")) SIDE.closeMore(); });
  SIDE.apply();
  // your shape is read after load (and another device can change it): the bar follows; this browser's old copy moves in once
  SHAPE.synced.then(() => { SIDE.adopt(); SIDE.apply(); });
  SHAPE.onChange(() => SIDE.apply());
  return SIDE;
}
