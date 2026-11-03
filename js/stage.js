// The panel: one right-hand card beside the conversation, with tools as labelled tabs: Files (the
// project's files, and the one place a file opens: js/files.js), Made (what threads made,
// js/recordview.js) and Map (where agents are working, js/map.js). Apps become more tabs later; past
// four, the rest fold into one "More" so the strip never wraps or scrolls (design-research/13).
//
// One button in every conversation's header (⌘\) opens it: on Files the first time, then on the tool
// you used last. Predictable, never "smart". A file opened from anywhere (a chip in a turn, Made, the
// Map) brings Files forward with that file; closing the file closes the panel again if it opened just
// for it.
//
// The panel owns the frame: the card, the tabs, full size, close, Escape, whether it's open (kept per
// browser), and the page making room for it (body.stage-open, body.stage-full). Each tool owns only
// what's inside its tab. The Needs you panel takes the right side while it's open and gives it back.
//
// The Map mounts through the contract agreed with its thread: mount(host) once, show(view) / hide(),
// render(view), live(view); its files open through the openFile app.js gives it.
//
// app.js calls: button, toggle, open, close, sync, isOpen, owns.

import { ICON, $ } from "./ui.js";

const KEY = "xo-stage";
const TOOLS = ["files", "made", "map"];
const MORE_AT = 4; // tabs shown before the rest fold into "More"
const PANEL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M14.5 4.5v15"/><path d="M17 8.5h1.5M17 11.5h1.5"/></svg>';
const FULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const UNFULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>';

const sget = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
const sset = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

/**
 * files: {mount, show, hide, render, reveal, auto}, filesIcon. made: {mount, show, count}. map: the Map
 * (mount, show, hide, live), mapIcon. viewer: the file viewer (it lives inside Files).
 * view(): the view on screen. onChange(): the app re-renders (header buttons).
 */
export function createStage({ files, filesIcon, made, map, mapIcon, viewer, view, announce, onChange }) {
  const saved = sget();
  const S = {
    open: false,
    tab: TOOLS.includes(saved.tab) ? saved.tab : "files",
    full: false,
    fileOnly: false,  // opened just to show a file: closing the file closes it
    returnTo: null,
    seenFile: null,   // the viewer's file we last brought forward
  };

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel");
  el.innerHTML = `<header class="stg-bar"><div class="stg-tabs" role="tablist" aria-label="Panel"></div>` +
    `<div class="stg-acts"><button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-body">${TOOLS.map((k) => `<div class="stg-pane" data-pane="${k}" role="tabpanel" aria-label="${k}" tabindex="-1" hidden></div>`).join("")}</div>`;
  $("#main").appendChild(el);
  const tabsEl = el.querySelector(".stg-tabs");
  const pane = (k) => el.querySelector(`[data-pane="${k}"]`);

  files.mount(pane("files"));
  made.mount(pane("made"));
  map.mount(pane("map"));

  function persist() { sset({ open: S.open, tab: S.tab }); }

  // ── showing a tool ────────────────────────────────────────────────────────
  function show(tab, { focus = true } = {}) {
    if (!TOOLS.includes(tab)) tab = "files";
    const was = S.tab;
    S.tab = tab;
    for (const k of TOOLS) pane(k).hidden = k !== tab;
    if (tab === "files") { if (viewer.hasFile) viewer.unpark(); files.show(view()); }
    else { if (viewer.isOpen) viewer.park(); if (was === "files") files.hide(); }
    if (tab === "map") map.show(view()); else map.hide();
    if (tab === "made") made.show(view());
    paint();
    persist();
    // focus lands where you'd type (Made's search) or on the tool's body, never ringing its first button
    if (focus) ((tab === "made" && pane(tab).querySelector("input")) || pane(tab)).focus({ preventScroll: true });
    onChange && onChange();
  }

  function open(tab = S.tab, { focus = true, fileOnly = false } = {}) {
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
    map.hide(); files.hide();
    if (viewer.hasFile) viewer.close({ restore: false });
    S.seenFile = null;
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

  function toggle() { if (S.open) close(); else open(S.tab); }

  // ── the strip: labelled tools; past MORE_AT, the rest fold into "More" ─────
  function paint() {
    if (!S.open) return;
    const v = view();
    const nMade = made.count(v);
    const live = !!map.live(v);
    const all = [
      { k: "files", label: "Files", icon: filesIcon, extra: "" },
      { k: "made", label: "Made", icon: ICON.spark, extra: nMade ? `<span class="stg-n">${nMade}</span>` : "" },
      { k: "map", label: "Map", icon: mapIcon, extra: live ? `<i class="stg-dot" aria-hidden="true" title="Agents at work"></i>` : "" },
    ];
    const shown = all.slice(0, MORE_AT);
    let html = shown.map((t) => `<button type="button" role="tab" class="stg-tab${S.tab === t.k ? " is-on" : ""}" data-stg-tab="${t.k}" aria-selected="${S.tab === t.k}">${t.icon}<span>${t.label}</span>${t.extra}</button>`).join("");
    if (all.length > MORE_AT) html += `<button type="button" class="stg-tab" data-stg-more aria-haspopup="menu">More</button>`;
    if (tabsEl._h !== html) { tabsEl.innerHTML = html; tabsEl._h = html; }
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  /** The world or the viewer moved: a file opened anywhere comes forward in Files; one closed goes. */
  function sync() {
    const f = viewer.hasFile ? viewer.file : null;
    if (f && viewer.isOpen && f !== S.seenFile) {
      S.seenFile = f;
      if (!S.open) open("files", { focus: false, fileOnly: !files.auto });
      else if (S.tab !== "files") show("files", { focus: false });
      if (!files.auto) files.reveal(f);
      return;
    }
    if (!f && S.seenFile) {
      S.seenFile = null;
      if (S.open && S.fileOnly) { close({ restore: true }); return; }
    }
    if (S.open && S.tab === "files") files.render(view());
    if (S.open && S.tab === "made") made.show(view());
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    const tb = t.closest("[data-stg-tab]");
    if (tb) { S.fileOnly = false; show(tb.dataset.stgTab); return; }
    if (t.closest("[data-stg-close]")) { close(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); }
  });
  // Esc: a file closes itself (the viewer's own key); a search clears first; then full size steps
  // back, then the panel closes
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (e.target.closest && e.target.closest("#viewer")) return;
    if (e.target.closest && e.target.closest("input") && e.target.value) return;
    e.preventDefault(); e.stopPropagation();
    if (S.full) setFull(false); else close();
  }, true);
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = [...tabsEl.querySelectorAll("[data-stg-tab]")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const nx = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].dataset.stgTab;
    show(nx, { focus: false }); tabsEl.querySelector(`[data-stg-tab="${nx}"]`)?.focus();
  });

  if (saved.open) requestAnimationFrame(() => open(S.tab, { focus: false }));

  return {
    get isOpen() { return S.open; },
    get tab() { return S.tab; },
    open, close, toggle, sync, show: (tab) => open(tab),
    /** Is this element inside the panel (so the app's Esc leaves it alone)? */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel on the last tool, or closes it. A dot while agents work here. */
    button(v) {
      const live = !!map.live(v);
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: Files, Made and Map" title="Files, Made and Map">${PANEL_IC}${live ? `<i class="stg-dot" aria-hidden="true"></i>` : ""}</button>`;
    },
  };
}
