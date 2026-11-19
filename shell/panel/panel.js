// @ts-check

// The panel: one right-hand column of stacked frames (Threads, Changes, Map; Launchpad over them) or one page in their place.

import { ICON, $ } from "../../js/ui.js";
import { redraw } from "../../js/redraw.js";
import { usable } from "../../js/focusview.js";
import { createChangesFrame, countsHtml } from "../../js/changesframe.js";
import { setTheme as diffTheme } from "../../js/diffview.js";
import { ORDER, MAP_H, ROW, createFrames } from "./frames.js";
import { FILTER_AT, threadsHtml, agentsHtml, changesHtml } from "./lists.js";
import { createPages } from "./pages.js";
import { createWidth } from "./width.js";

const KEY = "xo-stage";
const FR_KEY = "xo-stage-frames-3"; // Threads · Changes · Map, the Map folded at first
const PANEL_IC = ICON.panel;
const FULL_IC = ICON.full;
const UNFULL_IC = ICON.unfull;
const FOLD_IC = ICON.chevron;
const FILES_IC = ICON.folder;

/** @param {string} k */
const sget = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
/** @param {string} k @param {unknown} v */
const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

/** @typedef {{ map: any, files: any, changes: any, openFiles?: (() => void) | null, viewer: any, view: () => string, go: (v: string, e?: Event) => void, announce: (s: string) => void, onChange?: () => void, frames?: () => string[], launch?: any, threads?: any, shell?: ((on: boolean, host?: HTMLElement) => void) | null, owns?: (e: Event) => boolean, at: () => import("../../core/kernel/types").At, icon: (name: string) => string, places: import("../../core/kernel/types").Kernel["places"] }} StageDeps */

/** @param {StageDeps} deps */
export function createStage({ map, files, changes, openFiles = null, viewer, view, go, announce, onChange, frames = () => ORDER, launch = null, threads = null, shell = null, owns = () => false, at, icon, places }) {
  const saved = sget(KEY);
  // the Map starts folded, in its Graph: Threads and Changes have the room
  const fr = { changes: { folded: false }, agents: { rows: null, folded: false, groups: { done: true } }, map: { h: MAP_H, folded: true }, ...sget(FR_KEY) };
  if (!fr.agents.groups) fr.agents.groups = { done: true };
  if (!fr.map.h) fr.map.h = MAP_H;
  // a height dragged before Threads went by rows: its rows
  if (fr.agents.h) { fr.agents.rows = Math.max(1, Math.min(8, Math.round((fr.agents.h - 44) / ROW))); delete fr.agents.h; }
  /** @type {any} */
  const S = { lp: false, open: false, full: false, returnTo: null, wide: false, stackH: 0, h: { agents: "", changes: "", head: "", chn: "" } };

  /** @type {any} */
  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel: threads, changes and map");
  const frame = (/** @type {string} */ id, /** @type {string} */ title, acts = "") => `<section class="fr" data-fr="${id}" aria-labelledby="fr-title-${id}"><header class="fr-h"><h2 class="fr-title" id="fr-title-${id}">${title}${id !== "map" ? `<span class="fr-n" data-fr-n="${id}"></span>` : ""}</h2><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-${id}"${id === "map" ? ' role="tabpanel"' : ""}></div></section>`;
  const gutter = (/** @type {string} */ a, /** @type {string} */ b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts">${shell ? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false" title="A shell here, in the panel" aria-label="Shell in the panel">${ICON.shell}</button>` : ""}<button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-page stg-shell"></div>` +
    `<div class="stg-frames">` +
    `<section class="fr fr-lp is-folded" data-fr="launch" aria-labelledby="fr-title-launch" hidden><header class="fr-h"><h2 class="fr-title" id="fr-title-launch">Launchpad</h2><span class="lp-hs"></span><div class="fr-a"><span class="lp-ha"></span><button type="button" class="fr-ib fr-fold" data-fr-fold="launch" aria-expanded="false" title="Open">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-launch" tabindex="-1"></div><div class="fr-ghosts" role="group" aria-label="Under Launchpad"></div></section><div class="fr-line" data-lp-line hidden></div>` +
    // its search filters the list here, in place, not a sheet
    frame("agents", "Threads", `<button type="button" class="fr-ib" data-tg-find aria-controls="fr-body-agents" title="Filter threads (/)" aria-label="Filter threads" aria-keyshortcuts="/">${ICON.search}</button>`) + gutter("agents", "changes") +
    frame("changes", "Changes", `<button type="button" class="xd-follow" data-follow hidden></button><button type="button" class="fr-ib" data-open-files title="All files">${FILES_IC}</button>`) + gutter("changes", "map") +
    frame("map", "Map", `<div class="fr-views" role="tablist" aria-label="Map view"><button type="button" class="fr-t" role="tab" id="stage-map-tree" aria-controls="fr-body-map" data-map-mode="tree">Diagram</button><button type="button" class="fr-t" role="tab" id="stage-map-graph" aria-controls="fr-body-map" data-map-mode="graph">Graph</button></div>`) +
    `</div>`;
  const main = /** @type {HTMLElement} */ ($("#main"));
  main.appendChild(el);
  // the stack's height, as laid out, from its observer: Threads' cap is worked out from it without forcing a layout
  if (typeof ResizeObserver === "function") new ResizeObserver(([e]) => { const h = Math.round(e.contentRect.height); if (h !== S.stackH) { S.stackH = h; if (S.open) capAgents(); } }).observe(el.querySelector(".stg-frames"));
  const body = (/** @type {string} */ id) => el.querySelector(`[data-fr="${id}"] .fr-b`);
  // Threads' body: the filter field (kept, never redrawn under your typing) over the list (drawn in place)
  body("agents").innerHTML = `<div class="tg-q" hidden><label class="tg-qf">${ICON.search}<input type="search" data-tg-q placeholder="Filter threads" aria-label="Filter threads by title, summary or branch" aria-keyshortcuts="/" autocomplete="off" spellcheck="false"></label><kbd class="tg-k" aria-hidden="true">/</kbd></div><div class="tg-box"></div>`;
  {
    const inp = body("agents").querySelector("[data-tg-q]");
    inp.addEventListener("input", () => { S.tq = inp.value; paint(); });
    inp.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape" && inp.value) { e.preventDefault(); e.stopPropagation(); inp.value = ""; S.tq = ""; paint(); return; }
      // empty, Esc puts a field you opened away again and goes back to the search button
      if (e.key === "Escape" && S.tqOpen) { e.preventDefault(); e.stopPropagation(); S.tqOpen = false; paint(); el.querySelector("[data-tg-find]")?.focus({ preventScroll: true }); return; }
      if (e.key === "ArrowDown" || e.key === "Enter") { const r = body("agents").querySelector(".tg-box [data-go]"); if (r) { e.preventDefault(); if (e.key === "Enter") r.click(); else r.focus(); } }
    });
  }
  map.mount(body("map"));
  const LPF = el.querySelector('[data-fr="launch"]');
  if (launch) launch.mount(LPF, { open: () => openLaunch(), hide: () => { S.lp = false; layout(); paint(); } });
  // Changes: Space's list and diff, or (where Space has no /changes yet) today's list
  body("changes").innerHTML = `<div class="cx-host"></div><div class="ch-old" hidden></div>`;
  const CX = createChangesFrame({
    host: body("changes").firstElementChild, changes, view,
    openFile: (/** @type {any} */ s, /** @type {string} */ path, /** @type {any} */ from) => viewer.open({ path, name: path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${path}` : path, show: "changes" }, from),
    onChange: () => onChange && onChange(),
  });

  function persist() { sset(KEY, { open: S.open }); sset(FR_KEY, fr); }

  /** @type {(v: string) => string} */
  let nameOf = () => "";
  const PG = createPages({ el, S, places, at, icon, view, threads, shell, nameOf: () => nameOf, open, close, setFull, apply, paint, onChange });
  const { PAGES, show, sections, requestClose, setShell } = PG;
  const FR = createFrames({ el, S, fr, LPF, frames, view, launch, map, persist, paint, pressDeploy });
  function layout() { FR.layout(); }
  function capAgents() { FR.capAgents(); }

  /** @type {{ apply: () => void } | null} */
  let W = null;
  function apply() { W?.apply(); }

  /** The search button and /: the Threads filter, shown and focused. */
  function findThreads() {
    if (fr.agents.folded) { fr.agents.folded = false; persist(); layout(); }
    S.tqOpen = true; paint();
    const q = el.querySelector("[data-tg-q]"); q.focus({ preventScroll: true }); q.select();
  }

  function paint() {
    if (!S.open) return;
    const v = view();
    /** @type {any[]} */
    const ag = map.agents(v);
    // a clock's figures aren't a change; what changes is drawn in place, so the row you're on stays itself
    const set = (/** @type {string} */ k, /** @type {any} */ node, /** @type {string} */ html) => { const same = html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1"); if (S.h[k] !== same) { redraw(node, html); S.h[k] = same; } };
    set("head", el.querySelector(".stg-t"), PG.titleHtml());
    if (launch && !LPF.hidden) launch.paint(v, S.lp);
    // under Launchpad Threads is a head: its list waits
    const tg = /** @type {Array<{ k: string, rows: any[] }> | null} */ (threads ? threads(v) : null);
    const tq = (S.tq || "").trim().toLowerCase(), total = tg ? tg.reduce((n, x) => n + x.rows.length, 0) : 0;
    const qBox = body("agents").querySelector(".tg-q");
    qBox.hidden = !(tg && (total > FILTER_AT || tq || S.tqOpen));
    if (!S.lp) set("agents", body("agents").querySelector(".tg-box"), tg ? threadsHtml(tg, tq, { folds: fr.agents.groups, more: S.tgMore }) : agentsHtml(ag, v));
    // the threads, not the coordinator's row: the same count as the header's Threads
    el.querySelector('[data-fr-n="agents"]').textContent = tg ? (tg.reduce((n, x) => n + x.rows.filter((r) => !r.coord).length, 0) || "") : (ag.filter((a) => a.busy).length || "");
    // Changes: Space's list and diff where it has /changes, else today's list
    const cxOn = !fr.changes.folded && !S.lp && CX.paint();
    const hd = CX.head();
    const [cxHost, old] = body("changes").children;
    cxHost.hidden = !hd; old.hidden = !!hd;
    if (!hd && !S.lp) { const ch = files.changes(v); set("changes", old, changesHtml(ch, v)); }
    const empty = hd ? !hd.count : !files.changes(v).length;
    if (S.chEmpty !== empty) {
      // files arriving open Changes under Threads; a fold you made since stays
      if (S.chEmpty === true && !empty && fr.changes.folded) { fr.changes.folded = false; persist(); }
      S.chEmpty = empty; layout();
    }
    // the Map's Diagram | Graph only while the Map is open; its fold opens it
    { const mv = el.querySelector('[data-fr="map"] .fr-views'); if (mv) mv.hidden = !!fr.map.folded; }
    const n = el.querySelector('[data-fr-n="changes"]');
    set("chn", n, hd ? (hd.count ? `${hd.count}${hd.total.add || hd.total.del ? ` ${countsHtml(hd.total)}` : ""}` : "") : String(files.changes(v).length || ""));
    const fw = el.querySelector("[data-follow]");
    fw.hidden = !hd || !hd.count;
    if (hd) {
      const fh = hd.follow ? `${hd.busy ? '<i class="xd-arc" aria-hidden="true"></i>' : ""}<span>Following</span>` : "<span>Follow</span>";
      if (fw._h !== fh) { redraw(fw, fh); fw._h = fh; } // in place: its label stays the node a press is on
      fw.classList.toggle("is-on", hd.follow);
      fw.setAttribute("aria-pressed", String(hd.follow));
      fw.title = hd.follow ? "Following the agent: the file it changes shows here. Pick a file or scroll to stop." : "Follow the agent: show each file it changes as it changes it";
    }
    // the panel keeps its width while Launchpad is open, so folding Changes under it doesn't reflow the conversation
    if (!S.lp && S.wide !== (cxOn && CX.wide)) { S.wide = cxOn && CX.wide; apply(); }
    for (const b of el.querySelectorAll("[data-map-mode]")) { const on = map.mode === b.dataset.mapMode; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
    body("map").setAttribute("aria-labelledby", `stage-map-${map.mode}`);
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    FR.ghosts(); // last: the heads it copies are current by now
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  /** While the panel covers the page (full size, or on a phone) what's under it is inert; the herald and toast stay in reach. */
  function coverSync() {
    const on = S.open && !el.hidden && (S.full || innerWidth <= 760);
    /** @type {any[]} */
    const keep = [document.getElementById("herald")].filter(Boolean);
    // what should be inert is worked out whole each time; whatever this marked before and shouldn't be is released
    const want = /** @type {Set<any>} */ (new Set());
    const walk = (/** @type {any} */ root) => {
      for (const c of root.children) {
        if (c === el || c.classList.contains("toast-wrap") || keep.includes(c)) continue;
        if (keep.some((k) => c.contains(k))) walk(c);
        else want.add(c);
      }
    };
    // focus on what's about to be covered goes into the panel, never to the page
    const a = /** @type {any} */ (document.activeElement), outside = !!a && a !== document.body && !el.contains(a) && !keep.some((k) => k.contains(a)) && !a.closest(".toast-wrap");
    if (on && el.parentElement) walk(el.parentElement);
    for (const n of /** @type {any} */ (document.querySelectorAll("[data-stage-inert]"))) if (!want.has(n)) { n.inert = false; delete n.dataset.stageInert; }
    // only what isn't inert already is marked (another owner's inert stays its own)
    for (const n of want) if (!n.inert) { n.inert = true; n.dataset.stageInert = ""; }
    document.body.classList.toggle("stage-covers", on);
    if (on && (outside || document.activeElement === document.body) && (!a || a === document.body || !!a.closest("[inert]") || !a.isConnected)) el.focus({ preventScroll: true });
  }

  function open({ focus = true } = {}) {
    if (!S.open) {
      S.open = true;
      S.returnTo = document.activeElement;
      el.hidden = false;
      // its entrance starts in the next frame, not by forcing a layout in the middle of the switch that brought it
      el.classList.remove("is-in"); requestAnimationFrame(() => { if (S.open) el.classList.add("is-in"); });
      document.body.classList.add("stage-open");
    }
    apply();
    layout();
    paint();
    coverSync();
    persist();
    if (focus) el.focus({ preventScroll: true });
    onChange && onChange();
  }

  function close({ restore = true, quiet = false } = {}) {
    if (S.page) sections({ paint: false });
    if (!S.open) return;
    S.open = false;
    if (!quiet) S.lp = false; // closed by you: Launchpad is a head again next time; stepping aside keeps it
    if (S.full) setFull(false);
    el.hidden = true;
    coverSync(); // what it covered is in reach again before focus goes back to it
    document.body.classList.remove("stage-open");
    launch && launch.away && launch.away(); // typed secrets don't stay behind in a closed panel
    pressDeploy();
    map.hide();
    persist();
    // back to what opened it, or, if that was redrawn meanwhile, to the toggle on screen now: never to the page
    const back = [S.returnTo, ...document.querySelectorAll("[data-stage-toggle]")].find(usable);
    S.returnTo = null;
    if (restore && back) back.focus({ preventScroll: true });
    // the head is redrawn after this (its toggle with it): once it has been, focus is on the toggle drawn now
    if (restore) requestAnimationFrame(() => requestAnimationFrame(() => { const a = document.activeElement; if (!a || a === document.body || !a.isConnected) /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-stage-toggle]")]).find(usable)?.focus({ preventScroll: true }); }));
    if (!quiet) announce("Panel closed.");
    onChange && onChange();
  }

  /** The header's Deploy: the panel opens (if it isn't) with Launchpad open on top. */
  function openLaunch() {
    S.lp = true;
    S.lpOpened = !S.open; // pressed again, Deploy puts things back as they were
    if (!S.open) open({ focus: false }); else { layout(); paint(); }
    // focus goes into the section in the same step the panel opens (on a phone it covers Deploy); again next frame if needed
    const into = () => LPF.querySelector(".fr-b")?.focus?.({ preventScroll: true });
    into();
    if (!LPF.contains(document.activeElement)) requestAnimationFrame(into);
  }

  /** The header's Deploy shows Launchpad open as pressed, set here where it changes. */
  function pressDeploy() {
    const on = S.open && S.lp;
    for (const b of document.querySelectorAll("[data-lp-open]")) { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); }
  }

  /** @param {boolean} on */
  function setFull(on) {
    S.full = on;
    document.body.classList.toggle("stage-full", on);
    paint();
    coverSync();
  }

  function toggle() { if (S.open) close(); else open(); }

  /** Every render: the frames follow the view. */
  function sync() {
    // what the cover holds inert follows the page as it changes
    if (S.open || document.querySelector("[data-stage-inert]")) coverSync();
    if (!S.open) return;
    apply();
    if (LPF.hidden === !!(launch && launch.has(view()) && S.lp)) layout();
    paint();
  }

  el.addEventListener("click", (/** @type {any} */ e) => {
    const t = e.target;
    if (t.closest("[data-stg-close]")) { requestClose(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); return; }
    if (t.closest("[data-stg-shell]")) { setShell(S.page?.name !== "shell"); return; }
    if (t.closest("[data-stg-sections]")) { sections(); return; }
    const pa = t.closest("[data-stg-act]");
    if (pa && S.page) { PAGES.get(S.page.name).act?.(pa.dataset.stgAct, pa); return; }
    const tab = t.closest("[data-stg-tab]");
    if (tab) { const sp = PAGES.get(tab.dataset.stgTab); show(tab.dataset.stgTab, sp?.single ? S.single?.[tab.dataset.stgTab] ?? tab.dataset.stgKey : tab.dataset.stgKey, { focus: true }); return; }
    const fo = t.closest("[data-fr-fold]");
    if (fo) {
      const id = fo.dataset.frFold;
      if (id === "launch") S.lp = !S.lp;
      else if (S.lp) { S.lp = false; fr[id].folded = false; } // a head under an open Launchpad opens its frame
      else fr[id].folded = !fr[id].folded;
      layout(); paint(); persist(); return;
    }
    const gh = t.closest("[data-ghost]");
    if (gh) { const id = gh.dataset.ghost; S.lp = false; fr[id].folded = false; layout(); paint(); persist(); el.querySelector(`[data-fr="${id}"] [data-fr-fold]`)?.focus({ preventScroll: true }); return; }
    // Launchpad's head, folded: anywhere on it opens it (its links and buttons do their own thing)
    if (t.closest('[data-fr="launch"] .fr-h') && !S.lp && !t.closest("a,button")) { S.lp = true; layout(); paint(); return; }
    const mm = t.closest("[data-map-mode]");
    if (mm) { if (fr.map.folded) { fr.map.folded = false; layout(); } map.setMode(mm.dataset.mapMode); paint(); return; }
    if (t.closest("[data-open-files]")) { openFiles && openFiles(); return; }
    if (t.closest("[data-follow]")) { CX.toggleFollow(); paint(); return; }
    const ch = t.closest("[data-change]");
    if (ch) { const rel = ch.dataset.change; viewer.open({ path: rel, name: rel.split("/").pop(), project: ch.dataset.changeProject, rel }, ch); return; }
    const tf = t.closest("[data-tg-fold]");
    if (tf) { const k = tf.dataset.tgFold; fr.agents.groups = { ...(fr.agents.groups || {}), [k]: !fr.agents.groups?.[k] }; persist(); paint(); el.querySelector(`[data-tg-fold="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }); return; }
    const tm = t.closest("[data-tg-more]");
    if (tm) { const k = tm.dataset.tgMore; S.tgMore = { ...(S.tgMore || {}), [k]: true }; paint(); return; }
    if (t.closest("[data-tg-find]")) { findThreads(); return; }
    if (t.closest("[data-tg-clear]")) { const inp = el.querySelector("[data-tg-q]"); inp.value = ""; S.tq = ""; paint(); inp.focus(); return; }
    const g = t.closest("[data-go]");
    if (g) { go(g.dataset.go, e); }
  });
  // Esc: a search clears first; then full size steps back, then the panel closes
  el.addEventListener("keydown", (/** @type {any} */ e) => {
    // inside the Shell page's terminal every key is the shell's, by the shells' own rule
    if (owns(e)) return;
    if (e.target.closest?.("[data-map-mode]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const tabs = [...el.querySelectorAll("[data-map-mode]")], index = tabs.indexOf(e.target.closest("[data-map-mode]"));
      const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); tabs[next].click(); return;
    }
    // / in the panel goes to the Threads filter when it shows (elsewhere / still writes)
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.("input, textarea, [contenteditable]")) {
      if (!fr.agents.folded && el.querySelector('[data-fr="agents"]:not([hidden])')) { e.preventDefault(); e.stopPropagation(); findThreads(); return; }
    }
    if (e.key !== "Escape") return;
    if (e.target.closest && e.target.closest("input:not(.lp-in)") && e.target.value) return; // a search clears first; Launchpad's fields don't
    e.preventDefault(); e.stopPropagation();
    // the page first (its find bar, a question, an old version), then full size, then the sections, then closed
    if (S.page && PAGES.get(S.page.name).escape?.(S.page.key) === true) return;
    if (S.full) setFull(false); else if (S.page && S.page.name !== "shell") sections(); else requestClose();
  }, true);

  W = createWidth({ el, S, PAGES, coverSync, capAgents });

  if (saved.open) requestAnimationFrame(() => open({ focus: false }));

  return {
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
    /** The header's Threads: the panel open on its Threads whatever it showed, its first thread focused, its head glowing once. */
    threads() {
      if (S.page) sections({ paint: false });
      S.lp = false; fr.agents.folded = false;
      open({ focus: false });
      persist(); layout(); paint();
      const f = el.querySelector('[data-fr="agents"]'), b = body("agents");
      b.scrollTop = 0;
      (b.querySelector(".tg-box [data-go]") || el.querySelector('[data-fr-fold="agents"]'))?.focus({ preventScroll: true });
      f.classList.remove("is-flash"); void f.offsetWidth; f.classList.add("is-flash");
    },
    get isShell() { return S.page?.name === "shell"; },
    shellOff: () => setShell(false),
    page: PG.page, show, sections, closeTab: PG.closeTab, requestClose,
    pages: PG.pages,
    get pageShown() { return S.page ? { ...S.page } : null; },
    /** A page's width changed (Files' tree folded or opened, its width dragged): the panel fits it again, one write. */
    refit: () => apply(),
    /** The header's Deploy. */
    launch() {
      if (!(S.open && S.lp)) { openLaunch(); return; }
      if (S.lpOpened) close(); else { S.lp = false; layout(); paint(); }
    },
    /** Is Launchpad open in the panel (the header's Deploy reads as pressed)? */
    get launchOpen() { return S.open && S.lp; },
    /** The shape changed: the frames it keeps, at once. */
    reshape() { layout(); paint(); },
    /** A changed file's chip: the panel opens (if closed) on that file's diff; false when it can't. @param {string} path */
    showChange(path) {
      if (!frames().includes("changes") || !CX.head()) return false;
      if (!CX.select(path)) return false;
      fr.changes.folded = false;
      // a page in front: the sections come back to show it, the page kept as its tab
      if (S.page) sections({ paint: false });
      if (!S.open) open({ focus: false }); else { layout(); paint(); persist(); }
      return true;
    },
    /** You sent the agent a message: following resumes. @param {string} v */
    resumeFollow(v) { CX.resume(v); },
    /** The file chosen in the panel's Changes for a view, while the panel shows it. @param {string} v */
    chosen(v) { return S.open && !fr.changes.folded && frames().includes("changes") ? CX.chosen(v) : null; },
    /** The app's theme switched: drawn diffs follow. @param {string} t */
    theme: (t) => diffTheme(t),
    /** The place's name for the title bar (app.js knows the names). @param {(v: string) => string} fn */
    set names(fn) { nameOf = fn; },
    /** Is this element inside the panel (so the app's Esc leaves it alone)? @param {Node | null} node */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel, or closes it. No dot: nothing blinks here. */
    button() {
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: threads, changes and map" title="Threads, Changes and Map">${PANEL_IC}</button>`;
    },
  };
}
