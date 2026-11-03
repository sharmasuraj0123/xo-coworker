// The panel: one right-hand card beside the conversation, with tabs. Map (where agents are working,
// js/map.js), Made (what threads made, js/recordview.js) and File (a file you opened, js/viewer.js);
// later, apps become more tabs here. One button in every conversation's header (⌘\) opens it on the
// tab you used last, or closes it.
//
// The panel owns the frame: the card, the tabs, full size, close, Escape, whether it's open (kept per
// browser), and the page making room for it (body.stage-open, body.stage-full). Each tab owns only
// what's inside it. A file opened from anywhere (a chip in a turn, the Map, Made) comes forward as the
// File tab; closing it goes back to the tab before, or closes the panel if it opened just for the file.
// The Needs you panel takes the right side while it's open and gives it back.
//
// The Map: until map.js mounts into a host (the interface agreed with its thread: mount, show, hide,
// render, live, and openFile given by the panel), an adapter moves #map into the Map tab, hides its own
// card chrome (CSS under .stage), and drives its open()/close().
//
// app.js calls: button, toggle, open, close, sync, isOpen, owns.

import { esc } from "./util.js";
import { ICON, $ } from "./ui.js";

const KEY = "xo-stage";
const PANEL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M14.5 4.5v15"/><path d="M17 8.5h1.5M17 11.5h1.5"/></svg>';
const FULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const UNFULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>';

const sget = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
const sset = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

/**
 * map: the Map's object from createMap (today's API: open, close, isOpen, button, render; later mount,
 * show, hide, live). mapIcon: its icon. viewer: the file viewer. made: {mount(el), show(view), count(view)}.
 * view(): the view on screen. onChange(): the app re-renders (header buttons).
 */
export function createStage({ map, mapIcon, viewer, made, view, announce, onChange }) {
  const saved = sget();
  const S = {
    open: false,
    tab: saved.tab === "made" ? "made" : "map",   // the tab showing
    last: saved.tab === "made" ? "made" : "map",  // the last tab that isn't a file: where the button opens
    full: false,
    fileOnly: false,                              // opened just to show a file: closing the file closes it
    returnTo: null,
  };

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel");
  el.innerHTML = `<header class="stg-bar"><div class="stg-tabs" role="tablist" aria-label="Panel"></div>` +
    `<div class="stg-acts"><button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-body"><div class="stg-pane" data-pane="map" role="tabpanel" aria-label="Map" tabindex="-1"></div><div class="stg-pane" data-pane="made" role="tabpanel" aria-label="Made" tabindex="-1"></div><div class="stg-pane" data-pane="file" role="tabpanel" aria-label="File" tabindex="-1"></div></div>`;
  $("#main").appendChild(el);
  const tabsEl = el.querySelector(".stg-tabs");
  const pane = (k) => el.querySelector(`[data-pane="${k}"]`);

  // the tabs' contents: the Map mounts into its pane (or, today, moves in); the viewer moves in; Made draws
  if (typeof map.mount === "function") map.mount(pane("map"));
  else { const m = $("#map"); if (m) pane("map").appendChild(m); }
  const vw = $("#viewer");
  if (vw) pane("file").appendChild(vw);
  made.mount(pane("made"));

  const mapOpen = () => (typeof map.show === "function" ? map.show(view()) : !map.isOpen && map.open());
  const mapHide = () => { if (typeof map.hide === "function") map.hide(); };
  const mapClose = () => { if (typeof map.hide === "function") map.hide(); else if (map.isOpen) map.close(); };
  const mapLive = (v) => (typeof map.live === "function" ? !!map.live(v) : /map-dot/.test(map.button ? map.button(v) : ""));

  function persist() { sset({ open: S.open, tab: S.last }); }

  // ── showing a tab ─────────────────────────────────────────────────────────
  function show(tab, { focus = true } = {}) {
    if (tab === "file" && !viewer.hasFile) tab = S.last;
    S.tab = tab;
    if (tab !== "file") S.last = tab;
    for (const k of ["map", "made", "file"]) pane(k).hidden = k !== tab;
    if (tab === "file") viewer.unpark();
    else if (viewer.isOpen) viewer.park();
    if (tab === "map") mapOpen(); else mapHide();
    if (tab === "made") made.show(view());
    paint();
    persist();
    // focus lands where you'd type (Made's search) or on the tab's body, never ringing its first button
    if (focus) ((tab === "made" && pane(tab).querySelector("input")) || pane(tab)).focus({ preventScroll: true });
    onChange && onChange();
  }

  function open(tab = S.last, { focus = true, fileOnly = false } = {}) {
    if (!S.open) {
      S.open = true; S.fileOnly = fileOnly;
      S.returnTo = document.activeElement;
      el.hidden = false;
      el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in");
      document.body.classList.add("stage-open");
    } else if (!fileOnly) S.fileOnly = false;
    show(tab, { focus });
  }

  function close({ restore = true } = {}) {
    if (!S.open) return;
    S.open = false; S.fileOnly = false;
    if (S.full) setFull(false);
    el.hidden = true;
    document.body.classList.remove("stage-open");
    mapClose();
    if (viewer.hasFile) viewer.close({ restore: false });
    persist();
    const back = S.returnTo || document.querySelector("[data-stage-toggle]");
    S.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    announce("Panel closed.");
    onChange && onChange();
  }

  function setFull(on) {
    S.full = on;
    document.body.classList.toggle("stage-full", on);
    paint();
  }

  function toggle() { if (S.open) close(); else open(S.last); }

  // ── the strip ─────────────────────────────────────────────────────────────
  function paint() {
    if (!S.open) return;
    const v = view();
    const live = mapLive(v);
    const nMade = made.count(v);
    const tab = (k, label, icon, extra = "") => `<button type="button" role="tab" class="stg-tab${S.tab === k ? " is-on" : ""}" data-stg-tab="${k}" aria-selected="${S.tab === k}">${icon}<span>${label}</span>${extra}</button>`;
    let html = tab("map", "Map", mapIcon, live ? `<i class="stg-dot" aria-hidden="true" title="Agents at work"></i>` : "") +
      tab("made", "Made", ICON.spark, nMade ? `<span class="stg-n">${nMade}</span>` : "");
    if (viewer.hasFile) {
      const f = viewer.file || {};
      const name = f.name || String(f.path || "File").split("/").pop();
      html += `<span class="stg-filew${S.tab === "file" ? " is-on" : ""}"><button type="button" role="tab" class="stg-tab is-file" data-stg-tab="file" aria-selected="${S.tab === "file"}" title="${esc(f.path || name)}">${ICON.doc}<span>${esc(name)}</span></button>` +
        `<button type="button" class="stg-x" data-stg-closefile aria-label="Close ${esc(name)}" title="Close the file">${ICON.close}</button></span>`;
    }
    if (tabsEl._h !== html) { tabsEl.innerHTML = html; tabsEl._h = html; }
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  /** The world or the viewer moved: follow it (a file opened anywhere comes forward; a closed one goes). */
  function sync() {
    if (viewer.isOpen && S.tab !== "file") {
      // a file was opened (from a turn's chip, the Map, Made): it comes forward
      if (!S.open) open("file", { focus: false, fileOnly: true });
      else show("file", { focus: false });
      return;
    }
    if (S.open && S.tab === "file" && !viewer.hasFile) {
      if (S.fileOnly) { close({ restore: true }); return; }
      show(S.last, { focus: false });
      return;
    }
    if (S.open && S.tab === "made") made.show(view());
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    const tb = t.closest("[data-stg-tab]");
    if (tb) { show(tb.dataset.stgTab); return; }
    if (t.closest("[data-stg-closefile]")) { viewer.close({ restore: false }); return; }
    if (t.closest("[data-stg-close]")) { close(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); }
  });
  // Esc: a file closes itself (the viewer's own key); otherwise full size steps back, then the panel closes
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || S.tab === "file") return;
    if (e.target.closest && e.target.closest("input") && e.target.value) return; // a search clears first
    e.preventDefault(); e.stopPropagation();
    if (S.full) setFull(false); else close();
  }, true);
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = [...tabsEl.querySelectorAll("[data-stg-tab]")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const nx = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    show(nx.dataset.stgTab, { focus: false }); tabsEl.querySelector(`[data-stg-tab="${nx.dataset.stgTab}"]`)?.focus();
  });

  // the Map came back open from a reload with no panel around it: the panel opens around it, or it closes
  if (saved.open) requestAnimationFrame(() => open(S.last, { focus: false }));
  else if (typeof map.mount !== "function" && map.isOpen) requestAnimationFrame(() => { if (!S.open) map.close(); });

  return {
    get isOpen() { return S.open; },
    get tab() { return S.tab; },
    open, close, toggle, sync, show: (tab) => open(tab),
    /** Is this element inside the panel (so the app's Esc leaves it alone)? */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel on the last tab, or closes it. A dot while agents work here. */
    button(v) {
      const live = mapLive(v);
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: Map, Made and files" title="Map, Made and files">${PANEL_IC}${live ? `<i class="stg-dot" aria-hidden="true"></i>` : ""}</button>`;
    },
  };
}
