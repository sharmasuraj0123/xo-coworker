// @ts-check

import { esc } from "../../core/platform/util.js";
import { once } from "../../core/platform/pending.js";
import { clockWords } from "../../core/platform/time.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { startUndoRings } from "../../core/ui/undo-ring.js";
import { focusOpened, menuKeys, radioKeys } from "../../core/ui/a11y/keynav.js";
import { agendaOf, noticedOf, weekOf } from "./model.js";
import { REFRESH_MS } from "./pending.js";
import { emptyHtml, lastLead, listHtml, agendaHtml, weekHtml } from "./views.js";

/** @import { Automation, PageDeps, Tab } from "./types" */

const TABS = /** @type {const} */ ([["upcoming", "Upcoming"], ["found", "Found something"], ["off", "Off"]]);

/** @returns {string | null} */
const noId = () => null;

const EMPTY = "Ask a coordinator in any project to do something on a schedule, or make one here with New.";

/** What runs this week, what found something, what's off; one opens beside the list. @param {PageDeps} deps */
export function createAutomationsPage(deps) {
  const now = deps.now ?? Date.now;
  /** @type {Tab} */
  let tab = "upcoming";
  let menu = noId(), confirm = noId(), selected = noId();
  let readAt = 0;
  /** @type {HTMLElement | null} */
  let main = null;
  /** @type {HTMLElement | null} */
  let aside = null;
  const side = deps.side({ shown(id) { selected = id; if (aside) aside.hidden = id === null; paint(); } });
  const unwatch = deps.store.watch(() => paint());
  /** @type {(() => void)[]} */
  const undo = [];

  const rowState = () => ({ menu, confirm, selected, deleting: deps.store.state.deleting, projectName: deps.projectName });

  /** @param {Automation[]} list */
  function upcomingHtml(list) {
    const on = list.filter((a) => a.on), t = now(), days = agendaOf(on, t);
    const listed = new Set(days.flatMap((day) => day.items.map((item) => item.automation.id)));
    const later = on.filter((a) => !listed.has(a.id));
    const s = rowState();
    return weekHtml(weekOf(on, t)) + (days.length ? agendaHtml(days, s) : `<p class="au-none">Nothing runs in the next seven days.</p>`) +
      (later.length ? `<h2 class="au-day">Later</h2>` + listHtml(later, s,
        (a) => Number.isFinite(a.next) ? esc(clockWords(new Date(a.next).toISOString(), t)) : "") : "");
  }

  function bodyHtml() {
    const { list, loaded, failed } = deps.store.state;
    if (!loaded) return `<p class="au-none">Reading your automations…</p>`;
    if (failed && !list.length) {
      return `<div class="au-empty"><b>Couldn't read your automations.</b>` +
        `<button type="button" class="btn" data-au-act="reload">Try again</button></div>`;
    }
    if (!list.length) return emptyHtml("No automations yet", EMPTY);
    if (tab === "found") {
      const found = noticedOf(list);
      if (!found.length) return emptyHtml("Nothing to look at", "Runs that find something or fail show here.");
      return listHtml(found, rowState(), lastLead);
    }
    if (tab === "off") {
      const off = list.filter((a) => !a.on);
      if (!off.length) return emptyHtml("Nothing is off", "Automations you or XO turn off show here, with why.");
      return listHtml(off, rowState(), () => "");
    }
    return upcomingHtml(list);
  }

  function pageHtml() {
    const { list } = deps.store.state;
    const counts = { upcoming: 0, found: noticedOf(list).length, off: list.filter((a) => !a.on).length };
    const tabs = TABS.map(([key, words]) => `<button type="button" role="radio" aria-checked="${tab === key}"` +
      ` tabindex="${tab === key ? 0 : -1}" data-au-tab="${key}">${esc(words)}` +
      `${counts[key] ? `<i>${counts[key]}</i>` : ""}</button>`).join("");
    return `<div class="au-page"><header class="au-top"><div><h1 id="auto-h" tabindex="-1">Automations</h1>` +
      `<p>Agents that run on their own, in your projects.</p></div>` +
      `<button type="button" class="btn" data-au-act="new"${deps.projects().length ? "" : " disabled"}>${xi("plus")}New</button></header>` +
      `<div class="rt-seg au-tabs" role="radiogroup" aria-label="Show">${tabs}</div><div class="au-body">${bodyHtml()}</div></div>`;
  }

  function paint() {
    if (!main) return;
    redraw(main, pageHtml());
    startUndoRings(main);
    const opened = menu ? main.querySelector(".au-row .au-menu") : null;
    if (opened instanceof HTMLElement && !opened.contains(document.activeElement)) focusOpened(opened);
  }

  /** @param {string} key @param {() => Promise<unknown>} work @param {string} words */
  const act = (key, work, words) => once(key, async () => {
    try { await work(); } catch (error) { deps.failed(error, words); }
  });

  /** @param {Event} e */
  function onClick(e) {
    const target = e.target instanceof Element ? e.target.closest("[data-au-act], [data-au-tab]") : null;
    const wasMenu = menu;
    if (!target) { if (menu) { menu = null; paint(); } return; }
    const tabKey = target.getAttribute("data-au-tab");
    if (tabKey) { tab = /** @type {Tab} */ (tabKey); menu = null; confirm = null; paint(); return; }
    const what = target.getAttribute("data-au-act"), id = target.getAttribute("data-au-id") ?? "";
    const a = deps.store.find(id);
    menu = null;
    if (what === "new") { side.create(deps.projects()[0]?.chat ?? ""); return; }
    if (what === "reload") { void deps.store.refresh(); return; }
    if (what === "undo") { deps.store.undoRemove(id); deps.announce("Kept"); return; }
    if (!a) { paint(); return; }
    if (what === "menu") { menu = wasMenu === id ? null : id; confirm = null; paint(); return; }
    if (what === "open" || what === "runs") side.open(a.id);
    else if (what === "edit") side.edit(a.id);
    else if (what === "duplicate") side.duplicate(a.id);
    else if (what === "delete") { confirm = a.id; paint(); focusIn("[data-au-act=keep]"); }
    else if (what === "keep") { confirm = null; paint(); focusIn(`[data-au-act=menu][data-au-id="${CSS.escape(a.id)}"]`); }
    else if (what === "delete-now") {
      confirm = null;
      if (side.id === a.id) side.close();
      deps.store.removeLater(a.id);
      deps.announce(`${a.name} deleted. Undo for 10 seconds.`);
    } else if (what === "run") void act(`au-run:${a.id}`, () => deps.store.runNow(a), "Couldn't start it.");
    else if (what === "toggle") {
      void act(`au-on:${a.id}`, () => deps.store.setOn(a, !a.on), a.on ? "Couldn't turn it off." : "Couldn't turn it on.");
    }
    paint();
  }

  /** @param {string} selector */
  function focusIn(selector) {
    const el = main?.querySelector(selector);
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  }

  return {
    /** @param {HTMLElement} host */
    mount(host) {
      host.innerHTML = `<div class="au-wrap"><div class="au-main"></div>` +
        `<aside class="au-side" aria-label="Automation" hidden></aside></div>`;
      const box = host.querySelector(".au-main"), beside = host.querySelector(".au-side");
      if (!(box instanceof HTMLElement) || !(beside instanceof HTMLElement)) return;
      main = box; aside = beside;
      side.mount(beside);
      box.addEventListener("click", onClick);
      undo.push(() => box.removeEventListener("click", onClick));
      const closeMenu = () => {
        const was = menu;
        menu = null;
        paint();
        focusIn(`[data-au-act=menu][data-au-id="${CSS.escape(was ?? "")}"]`);
      };
      undo.push(menuKeys(box, { close: closeMenu }), radioKeys(box));
    },
    render() {
      if (now() - readAt > REFRESH_MS) { readAt = now(); void deps.store.refresh(); }
      paint();
    },
    /** Esc on the page: a menu, a confirm, the form, then what's open beside the list. */
    escape() {
      if (menu || confirm) { menu = null; confirm = null; paint(); return true; }
      if (side.escape()) return true;
      if (side.id !== null || side.editing) { side.close(); return true; }
      return false;
    },
    get busy() { return !!(menu || confirm || side.id !== null || side.editing); },
    dispose() { unwatch(); side.dispose(); for (const off of undo.splice(0)) off(); },
  };
}
