// @ts-check

import { esc } from "../../core/platform/util.js";
import { once } from "../../core/platform/pending.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { startUndoRings } from "../../core/ui/undo-ring.js";
import { focusOpened, menuKeys, radioKeys } from "../../core/ui/a11y/keynav.js";
import { agendaOf, dayMonth, hhmm, noticedOf, weekOf } from "./model.js";
import { emptyHtml, foundHtml, listHtml, offHtml, agendaHtml, weekHtml } from "./views.js";

/** @import { Automation, AutomationsState, PageDeps, RowState, Tab } from "./types" */

const TABS = /** @type {const} */ ([["upcoming", "Upcoming"], ["found", "Found something"], ["off", "Off"]]);
const LEADS = { automations: "Agents that run on their own, in your projects.",
  agents: "Who threads and automations run as. A project's own agent replaces the Space's of the same name." };
const MODES = /** @type {const} */ ([["automations", "Automations"], ["agents", "Agents"]]);

/** @returns {string | null} */
const noId = () => null;

const EMPTY = "Ask a coordinator in any project to do something on a schedule, or make one here with New.";

/** @param {Automation[]} list @param {RowState} s @param {number} t */
function upcomingHtml(list, s, t) {
  const on = list.filter((a) => a.on), days = agendaOf(on, t);
  const listed = new Set(days.flatMap((day) => day.items.map((item) => item.automation.id)));
  const later = on.filter((a) => !listed.has(a.id));
  return weekHtml(weekOf(on, t)) + (days.length ? agendaHtml(days, s) : `<p class="au-none">Nothing runs in the next seven days.</p>`) +
    (later.length ? `<h2 class="au-day">Later</h2>` + listHtml(later, s,
      (a) => Number.isFinite(a.next) ? `${esc(dayMonth(a.next))} ${hhmm(a.next)}` : "") : "");
}

/** The list under the tabs. @param {AutomationsState} state @param {Tab} tab @param {RowState} s @param {number} t */
function bodyHtml({ list, loaded, failed }, tab, s, t) {
  if (!loaded) return `<p class="au-none">Reading your automations…</p>`;
  if (failed && !list.length) {
    return `<div class="au-empty"><b>Couldn't read your automations.</b>` +
      `<button type="button" class="btn" data-au-act="reload">Try again</button></div>`;
  }
  if (!list.length) return emptyHtml("No automations yet", EMPTY);
  if (tab === "found") {
    const found = noticedOf(list);
    if (!found.length) return emptyHtml("Nothing to look at", "Runs that find something or fail show here.");
    return `<p class="au-intro">Runs that found something or failed, newest first.</p>${foundHtml(found, s, t)}`;
  }
  if (tab === "off") {
    const off = list.filter((a) => !a.on);
    if (!off.length) return emptyHtml("Nothing is off", "Automations you or XO turn off show here, with why.");
    return `<p class="au-intro">These don't run. Turn one on and it starts again at its next time.</p>${offHtml(off, s)}`;
  }
  return upcomingHtml(list, s, t);
}

/** What runs this week, what found something, what's off; one opens beside the list. @param {PageDeps} deps */
export function createAutomationsPage(deps) {
  const now = deps.now ?? Date.now;
  /** @type {Tab} */
  let tab = "upcoming";
  /** @type {"automations" | "agents"} */
  let mode = "automations";
  let menu = noId(), confirm = noId(), selected = noId(), agentKey = noId();
  /** @type {HTMLElement | null} */
  let main = null;
  /** @type {HTMLElement | null} */
  let aside = null;
  /** @type {HTMLElement | null} */
  let agentAside = null;
  const side = deps.side({ shown(id) { selected = id; if (aside) aside.hidden = id === null; paint(); } });
  const agentSide = deps.agentSide({
    shown(key) { agentKey = key; if (agentAside) agentAside.hidden = key === null; paint(); },
    openJob(id) { setMode("automations"); side.open(id); },
  });
  const agents = deps.agentList({ selected: () => agentKey, shown: () => mode === "agents", changed: () => paint() });
  const unwatch = deps.store.watch(() => paint());
  /** @type {(() => void)[]} */
  const undo = [];

  const rowState = () => ({ menu, confirm, selected, deleting: deps.store.state.deleting, projectName: deps.projectName });

  function pageHtml() {
    const { list } = deps.store.state;
    const counts = { upcoming: 0, found: noticedOf(list).length, off: list.filter((a) => !a.on).length };
    const tabs = TABS.map(([key, words]) => `<button type="button" role="radio" aria-checked="${tab === key}"` +
      ` tabindex="${tab === key ? 0 : -1}" data-au-tab="${key}">${esc(words)}` +
      `${counts[key] ? `<i>${counts[key]}</i>` : ""}</button>`).join("");
    const modes = MODES.map(([key, words]) => `<button type="button" role="radio" aria-checked="${mode === key}"` +
      ` tabindex="${mode === key ? 0 : -1}" data-au-mode="${key}">${esc(words)}</button>`).join("");
    const canNew = mode === "agents" || deps.projects().length;
    return `<div class="au-page"><header class="au-top"><div><h1 id="auto-h" tabindex="-1">Automations</h1>` +
      `<p>${esc(LEADS[mode])}</p></div>` +
      `<button type="button" class="btn" data-au-act="new"${canNew ? "" : " disabled"}>${xi("plus")}New</button></header>` +
      `<div class="rt-seg au-mode" role="radiogroup" aria-label="Page">${modes}</div>` +
      (mode === "automations" ? `<div class="rt-seg au-tabs" role="radiogroup" aria-label="Show">${tabs}</div>` : "") +
      `<div class="au-body">${mode === "agents" ? agents.html() : bodyHtml(deps.store.state, tab, rowState(), now())}</div></div>`;
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
    const target = e.target instanceof Element ? e.target.closest("[data-au-act], [data-au-tab], [data-au-mode], [data-ag-act]") : null;
    const wasMenu = menu;
    if (!target) { if (menu) { menu = null; paint(); } return; }
    const modeKey = target.getAttribute("data-au-mode");
    if (modeKey) { setMode(/** @type {"automations" | "agents"} */ (modeKey)); return; }
    if (target.hasAttribute("data-ag-act")) {
      const key = target.getAttribute("data-ag-key");
      if (target.getAttribute("data-ag-act") === "open" && key) agentSide.open(key);
      else if (agents.onClick(target)) paint();
      return;
    }
    const tabKey = target.getAttribute("data-au-tab");
    if (tabKey) { tab = /** @type {Tab} */ (tabKey); menu = null; confirm = null; paint(); return; }
    const what = target.getAttribute("data-au-act"), id = target.getAttribute("data-au-id") ?? "";
    const a = deps.store.find(id);
    menu = null;
    if (what === "new") { if (mode === "agents") agentSide.create(); else side.create(deps.projects()[0]?.chat ?? ""); return; }
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

  /** @param {"automations" | "agents"} next */
  function setMode(next) {
    if (next === mode) return;
    if (next === "agents") side.close(); else agentSide.close();
    mode = next; menu = null; confirm = null;
    paint();
    focusIn(`[data-au-mode="${next}"]`);
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
        `<aside class="au-side" aria-label="Automation" hidden></aside><aside class="au-side" aria-label="Agent" hidden></aside></div>`;
      const box = host.querySelector(".au-main"), [beside, agentBeside] = host.querySelectorAll(".au-side");
      if (!(box instanceof HTMLElement) || !(beside instanceof HTMLElement) || !(agentBeside instanceof HTMLElement)) return;
      main = box; aside = beside; agentAside = agentBeside;
      side.mount(beside);
      agentSide.mount(agentBeside);
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
      deps.store.fresh();
      paint();
    },
    /** Esc on the page: a menu, a confirm, the form, then what's open beside the list. */
    escape() {
      if (menu || confirm) { menu = null; confirm = null; paint(); return true; }
      if (side.escape() || agentSide.escape()) return true;
      if (side.id !== null || side.editing) { side.close(); return true; }
      if (agentSide.key !== null) { agentSide.close(); return true; }
      return agents.escape();
    },
    get busy() {
      return !!(menu || confirm || side.id !== null || side.editing || agentSide.key !== null || agentSide.editing || agents.importing);
    },
    dispose() { unwatch(); side.dispose(); agentSide.dispose(); agents.dispose(); for (const off of undo.splice(0)) off(); },
  };
}
