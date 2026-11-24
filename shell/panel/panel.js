// @ts-check

// The panel: one right-hand column of stacked frames (Threads, Changes, Map) or one page in their place.

import { $ } from "../../core/platform/dom.js";
import { createScope } from "../../core/kernel/scope.js";
import { read, write } from "../../core/platform/storage.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { entryInput, usable } from "../../core/ui/a11y/focus.js";
import { ORDER, MAP_H, ROW, createFrames } from "./frames.js";
import { FILTER_AT, threadsHtml, agentsHtml, changesHtml } from "./lists.js";
import { createPages } from "./pages.js";
import { createCover, createWidth } from "./width.js";
import { countsHtml } from "../../core/ui/components/counts.js";
/** @import { ChangesFrame, FrameState, MapFrame, StageDeps, StageState } from "./panel-types.d.ts" */

const KEY = "xo-stage";
const FR_KEY = "xo-stage-frames-3"; // Threads · Changes · Map, the Map folded at first
const PANEL_IC = ICON.panel;
const FULL_IC = ICON.full;
const UNFULL_IC = ICON.unfull;
const FOLD_IC = ICON.chevron;
const FILES_IC = ICON.folder;

/** @param {StageDeps} deps */
export function createStage({ files, openFiles = null, github = null, place = () => true, viewer, view, go, announce, onChange, frames = () => ORDER, threads = null, shell = null, owns = () => false, at, places }) {
  const savedOpen = read(KEY, (value) => Boolean(JSON.parse(value)?.open), false);
  const mapFrame = /** @type {MapFrame | undefined} */ (places.get("panel.frame", "map"));
  const changesFrame = /** @type {ChangesFrame | undefined} */ (places.get("panel.frame", "changes"));
  if (!mapFrame || !changesFrame) throw new Error("Panel frames are missing");
  const layoutScope = createScope();
  const map = mapFrame.api;
  // the Map starts folded, in its Graph: Threads and Changes have the room
  /** @type {Partial<FrameState>} */
  const savedFrames = read(FR_KEY, JSON.parse, {});
  /** @type {FrameState} */
  const fr = { changes: { folded: false }, agents: { rows: null, folded: false, groups: { done: true } }, map: { h: MAP_H, folded: true }, ...savedFrames };
  if (!fr.agents.groups) fr.agents.groups = { done: true };
  if (!fr.map.h) fr.map.h = MAP_H;
  // a height dragged before Threads went by rows: its rows
  if (fr.agents.h) { fr.agents.rows = Math.max(1, Math.min(8, Math.round((fr.agents.h - 44) / ROW))); delete fr.agents.h; }
  /** @type {StageState} */
  const S = { open: false, full: false, returnTo: null, stackH: 0, h: {}, page: null, under: null, tgMore: {} };

  const el = document.createElement("aside");
  const query = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (el.querySelector(selector));
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel: threads, changes and map");
  /** @type {Record<string, string>} */
  const FRAME_IC = { agents: "threads", changes: "changes", map: "map" };
  const frame = (/** @type {string} */ id, /** @type {string} */ title, acts = "") => `<section class="fr" data-fr="${id}" aria-labelledby="fr-title-${id}"><header class="fr-h"><h2 class="fr-title" id="fr-title-${id}">${xi(FRAME_IC[id], "fr-ic")}${title}${id !== "map" ? `<span class="fr-n" data-fr-n="${id}"></span>` : ""}</h2><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-${id}"${id === "map" ? ' role="tabpanel"' : ""}></div></section>`;
  const gutter = (/** @type {string} */ a, /** @type {string} */ b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts"><span class="stg-pa"></span>${openFiles ? `<button type="button" class="stg-ic" data-open-files aria-pressed="false" title="All files" aria-label="All files">${FILES_IC}</button>` : ""}${github ? `<button type="button" class="stg-ic" data-open-gh aria-pressed="false" title="Issues and pull requests" aria-label="Issues and pull requests" hidden>${ICON.github}</button>` : ""}${shell ? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false" title="A shell here, in the panel" aria-label="Shell in the panel">${ICON.shell}</button>` : ""}<button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-body"><div class="stg-frames">` +
    frame("agents", "Threads", `<button type="button" class="fr-ib" data-tg-find aria-controls="fr-body-agents" title="Filter threads (/)" aria-label="Filter threads" aria-keyshortcuts="/">${ICON.search}</button>`) + gutter("agents", "changes") +
    frame("changes", "Changes", `<button type="button" class="xd-follow" data-follow hidden>${ICON.follow}</button>`) + gutter("changes", "map") +
    frame("map", "Map", `<div class="fr-views" role="tablist" aria-label="Map view"><button type="button" class="fr-t" role="tab" id="stage-map-tree" aria-controls="fr-body-map" data-map-mode="tree" title="Diagram" aria-label="Diagram">${ICON.map}</button><button type="button" class="fr-t" role="tab" id="stage-map-graph" aria-controls="fr-body-map" data-map-mode="graph" title="Graph" aria-label="Graph">${ICON.graph}</button></div>`) +
    `</div><div class="stg-page"></div></div>`;
  const main = /** @type {HTMLElement} */ ($("#main"));
  main.appendChild(el);
  // the stack's height, as laid out, from its observer: Threads' cap is worked out from it without forcing a layout
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.contentRect.height);
      if (height === S.stackH) return;
      S.stackH = height;
      if (S.open) { capAgents(); edges(); }
    });
    observer.observe(query(".stg-frames"));
    layoutScope.observe(observer);
  }
  const LISTS = '[data-fr="agents"] > .fr-b, .ch-old';
  const edge = (/** @type {Element} */ b) => b.classList.toggle("is-fade", b.scrollTop + b.clientHeight < b.scrollHeight - 1);
  let edgeF = 0;
  const edges = () => { if (!edgeF) edgeF = requestAnimationFrame(() => { edgeF = 0; for (const b of el.querySelectorAll(LISTS)) edge(b); }); };
  el.addEventListener("scroll", (/** @type {Event} */ e) => {
    const target = /** @type {Element | null} */ (e.target);
    if (target?.matches?.(LISTS)) edge(target);
  }, { capture: true, passive: true });
  const body = (/** @type {string} */ id) => query(`[data-fr="${id}"] .fr-b`);
  const filter = () => /** @type {HTMLInputElement} */ (query("[data-tg-q]"));
  // Threads' body: the filter field (kept, never redrawn under your typing) over the list (drawn in place)
  body("agents").innerHTML = `<div class="tg-q" hidden><label class="tg-qf">${ICON.search}<input type="search" data-tg-q placeholder="Filter threads" aria-label="Filter threads by title, summary or branch" aria-keyshortcuts="/" autocomplete="off" spellcheck="false"></label><kbd class="tg-k" aria-hidden="true">/</kbd></div><div class="tg-box"></div>`;
  {
    const inp = filter();
    inp.addEventListener("input", () => { S.tq = inp.value; paint(); });
    inp.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape" && inp.value) { e.preventDefault(); e.stopPropagation(); inp.value = ""; S.tq = ""; paint(); return; }
      // empty, Esc puts a field you opened away again and goes back to the search button
      if (e.key === "Escape" && S.tqOpen) { e.preventDefault(); e.stopPropagation(); S.tqOpen = false; paint(); query("[data-tg-find]")?.focus({ preventScroll: true }); return; }
      if (e.key === "ArrowDown" || e.key === "Enter") { const r = query(".tg-box [data-go]"); if (r) { e.preventDefault(); if (e.key === "Enter") r.click(); else r.focus(); } }
    });
  }
  mapFrame.mount(body("map"));
  // Changes: Space's list and diff, or (where Space has no /changes yet) today's list
  body("changes").innerHTML = `<div class="cx-host"></div><div class="ch-old" hidden></div>`;
  const CX = changesFrame.mount(query(".cx-host"), {
    view,
    openFile: ({ project, worktree }, path, from) => viewer.open({
      path, name: path.split("/").pop(), project, rel: worktree ? `.xo/worktrees/${worktree}/${path}` : path, show: "changes",
    }, from),
    onChange: () => onChange && onChange(),
  });

  function persist() { write(KEY, JSON.stringify({ open: S.open || !!S.resume })); write(FR_KEY, JSON.stringify(fr)); }

  const placeless = () => !place(view());

  /** @type {(v: string) => string} */
  let nameOf = () => "";
  const PG = createPages({ el, S, places, at, view, threads, shell, nameOf: () => nameOf, placeless, open, close, paint, onChange });
  const { PAGES, show, back, dropPages, requestClose, setShell } = PG;
  const FR = createFrames({ el, S, fr, frames, view, map, persist, paint });
  function layout() { FR.layout(); }
  function capAgents() { FR.capAgents(); }

  /** @type {{ apply: () => void } | null} */
  let W = null;
  function apply() { W?.apply(); }

  function findThreads() {
    if (fr.agents.folded) { fr.agents.folded = false; persist(); layout(); }
    S.tqOpen = true; paint();
    const q = filter(); q.focus({ preventScroll: true }); q.select();
  }

  function paint() {
    PG.reflect();
    if (!S.open) return;
    const v = view();
    const ag = map.agents(v);
    // a clock's figures aren't a change; what changes is drawn in place, so the row you're on stays itself
    const set = (/** @type {string} */ k, /** @type {HTMLElement} */ node, /** @type {string} */ html) => {
      const same = html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1");
      if (S.h[k] !== same) { redraw(node, html); S.h[k] = same; }
    };
    set("head", query(".stg-t"), PG.titleHtml());
    const covered = !!S.page;
    if (github) {
      const button = query("[data-open-gh]");
      github.has(v).then((ok) => { if (button.hidden === ok) button.hidden = !ok; });
    }
    const tg = threads?.(v);
    const tq = (S.tq || "").trim().toLowerCase(), total = tg ? tg.reduce((n, x) => n + x.rows.length, 0) : 0;
    const qBox = query(".tg-q");
    qBox.hidden = !(tg && (total > FILTER_AT || tq || S.tqOpen));
    if (!covered) set("agents", query(".tg-box"), tg ? threadsHtml(tg, tq, { folds: fr.agents.groups, more: S.tgMore }) : agentsHtml(ag, v));
    // the threads, not the coordinator's row: the same count as the header's Threads
    const agentCount = query('[data-fr-n="agents"]');
    const count = String(tg ? (tg.reduce((n, x) => n + x.rows.filter((r) => !r.coord).length, 0) || "") : (ag.filter((a) => a.busy).length || ""));
    if (agentCount.textContent !== count) agentCount.textContent = count;
    // Changes: Space's list and diff where it has /changes, else today's list
    if (!fr.changes.folded && !covered) CX.paint();
    const hd = CX.head();
    const cxHost = query(".cx-host"), old = query(".ch-old");
    cxHost.hidden = !hd; old.hidden = !!hd;
    if (!hd && !covered) { const ch = files.changes(v); set("changes", old, changesHtml(ch, v)); }
    edges();
    const empty = hd ? !hd.count : !files.changes(v).length;
    if (S.chEmpty !== empty) {
      // files arriving open Changes under Threads; a fold you made since stays
      if (S.chEmpty === true && !empty && fr.changes.folded) { fr.changes.folded = false; persist(); }
      S.chEmpty = empty; layout();
    }
    // the Map's Diagram | Graph only while the Map is open; its fold opens it
    query('[data-fr="map"] .fr-views').hidden = !!fr.map.folded;
    const n = query('[data-fr-n="changes"]');
    set("chn", n, hd ? (hd.count ? `${hd.count}${hd.total.add || hd.total.del ? ` ${countsHtml(hd.total)}` : ""}` : "") : String(files.changes(v).length || ""));
    const fw = query("[data-follow]");
    fw.hidden = !hd || !hd.count;
    if (hd) {
      fw.classList.toggle("is-on", hd.follow);
      fw.setAttribute("aria-pressed", String(hd.follow));
      fw.title = hd.follow ? "Following the agent: the file it changes shows here. Pick a file or scroll to stop." : "Follow the agent: show each file it changes as it changes it";
      fw.setAttribute("aria-label", hd.follow ? "Following the agent" : "Follow the agent");
    }
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("[data-map-mode]"))) {
      const on = map.mode === b.dataset.mapMode;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    }
    body("map").setAttribute("aria-labelledby", `stage-map-${map.mode}`);
    const fb = query("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    redraw(fb, fh);
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  const coverSync = createCover(el, S, layoutScope);

  function open({ focus = true } = {}) {
    if (placeless()) return;
    if (!S.open) {
      S.open = true;
      S.returnTo = /** @type {HTMLElement | null} */ (document.activeElement);
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
    github?.leave?.();
    if (S.page) dropPages();
    if (!S.open) return;
    S.open = false;
    if (S.full) setFull(false);
    el.hidden = true;
    coverSync(); // what it covered is in reach again before focus goes back to it
    document.body.classList.remove("stage-open");
    map.hide();
    persist();
    // back to what opened it, or, if that was redrawn meanwhile, to the toggle on screen now: never to the page
    const toggles = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-stage-toggle]"));
    const back = [S.returnTo, ...toggles].find(usable);
    S.returnTo = null;
    if (restore && back) back.focus({ preventScroll: true });
    // the head is redrawn after this (its toggle with it): once it has been, focus is on the toggle drawn now
    if (restore) requestAnimationFrame(() => requestAnimationFrame(() => { const a = document.activeElement; if (!a || a === document.body || !a.isConnected) /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-stage-toggle]")]).find(usable)?.focus({ preventScroll: true }); }));
    if (!quiet) announce("Panel closed.");
    onChange && onChange();
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
    if (placeless()) { if (S.open) { S.resume = true; close({ restore: false, quiet: true }); } }
    else if (S.resume) { S.resume = false; open({ focus: false }); }
    // what the cover holds inert follows the page as it changes
    if (S.open) coverSync();
    if (!S.open) return;
    apply();
    paint();
  }

  el.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const closest = (/** @type {string} */ selector) => /** @type {HTMLElement | null} */ (t.closest(selector));
    if (t.closest("[data-stg-close]")) { requestClose(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); return; }
    if (t.closest("[data-stg-shell]")) { setShell(S.page?.name !== "shell"); return; }
    if (t.closest("[data-stg-sections]")) { if (!(S.page && PAGES.get(S.page.name)?.up?.(S.page.key) === true)) back(entryInput(e)); return; }
    const pa = closest("[data-stg-act]");
    if (pa?.dataset.stgAct && S.page) { PAGES.get(S.page.name)?.act?.(pa.dataset.stgAct, pa); return; }
    const id = closest("[data-fr-fold]")?.dataset.frFold;
    if (id === "agents" || id === "changes" || id === "map") {
      fr[id].folded = !fr[id].folded;
      layout(); paint(); persist(); return;
    }
    const mode = closest("[data-map-mode]")?.dataset.mapMode;
    if (mode) { if (fr.map.folded) { fr.map.folded = false; layout(); } map.setMode(mode); paint(); return; }
    if (t.closest("[data-open-gh]")) { if (S.page?.name === "github" || S.page?.name === "ghitem") dropPages(); else github?.show(); return; }
    if (t.closest("[data-open-files]")) { if (S.page?.name === "files") back(entryInput(e)); else openFiles && openFiles(); return; }
    if (t.closest("[data-follow]")) { CX.toggleFollow(); paint(); return; }
    const ch = closest("[data-change]"), rel = ch?.dataset.change;
    if (rel) { viewer.open({ path: rel, name: rel.split("/").pop(), project: ch?.dataset.changeProject, rel }, ch); return; }
    const fold = closest("[data-tg-fold]")?.dataset.tgFold;
    if (fold) {
      fr.agents.groups = { ...fr.agents.groups, [fold]: !fr.agents.groups[fold] }; persist(); paint();
      query(`[data-tg-fold="${CSS.escape(fold)}"]`)?.focus({ preventScroll: true }); return;
    }
    const more = closest("[data-tg-more]")?.dataset.tgMore;
    if (more) { S.tgMore[more] = true; paint(); return; }
    if (t.closest("[data-tg-find]")) { findThreads(); return; }
    if (t.closest("[data-tg-clear]")) { const inp = filter(); inp.value = ""; S.tq = ""; paint(); inp.focus(); return; }
    const destination = closest("[data-go]")?.dataset.go;
    if (destination) go(destination, e);
  });
  el.addEventListener("keydown", (e) => {
    // inside the Shell page's terminal every key is the shell's, by the shells' own rule
    if (owns(e) || !(e.target instanceof Element)) return;
    const tab = e.target.closest("[data-map-mode]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const tabs = [.../** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("[data-map-mode]"))];
      const index = tabs.findIndex((candidate) => candidate === tab);
      const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); tabs[next].click(); return;
    }
    // / in the panel goes to the Threads filter when it shows (elsewhere / still writes)
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest("input, textarea, [contenteditable]")) {
      if (!S.page && !fr.agents.folded && el.querySelector('[data-fr="agents"]:not([hidden])')) { e.preventDefault(); e.stopPropagation(); findThreads(); return; }
    }
    if (e.key !== "Escape") return;
    if (e.target.tagName === "INPUT" && /** @type {HTMLInputElement} */ (e.target).value) return;
    e.preventDefault(); e.stopPropagation();
    // the page first (its find bar, a question, an old version), then full size, then the sections, then closed
    if (S.page && PAGES.get(S.page.name)?.escape?.(S.page.key) === true) return;
    if (S.page) back(); else if (S.full) setFull(false); else requestClose();
  }, true);

  W = createWidth({ el, S, coverSync, capAgents, scope: layoutScope });

  if (savedOpen) S.resume = true;

  return {
    disposeLayout: layoutScope.dispose,
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
    /** The header's Threads: the panel open on its Threads whatever it showed, its first thread focused, its head glowing once. */
    threads() {
      if (S.page) dropPages();
      fr.agents.folded = false;
      open({ focus: false });
      persist(); layout(); paint();
      const f = query('[data-fr="agents"]'), b = body("agents");
      b.scrollTop = 0;
      (query(".tg-box [data-go]") || query('[data-fr-fold="agents"]'))?.focus({ preventScroll: true });
      f.classList.remove("is-flash"); void f.offsetWidth; f.classList.add("is-flash");
    },
    get isShell() { return S.page?.name === "shell"; },
    shellOff: () => setShell(false),
    page: PG.page, show, back, closePage: PG.closePage, requestClose,
    leave() { github?.leave?.(); dropPages(); },
    get slot() { return query(".stg-pa"); },
    get pageShown() { return S.page ? { ...S.page } : null; },
    repaint: () => paint(),
    /** The shape changed: the frames it keeps, at once. */
    reshape() { layout(); paint(); },
    /** A changed file's chip: the panel opens (if closed) on that file's diff; false when it can't. @param {string} path */
    showChange(path) {
      if (!frames().includes("changes") || !CX.head()) return false;
      if (!CX.select(path)) return false;
      fr.changes.folded = false;
      if (S.page) dropPages();
      if (!S.open) open({ focus: false }); else { layout(); paint(); persist(); }
      return true;
    },
    /** You sent the agent a message: following resumes. @param {string} v */
    resumeFollow(v) { CX.resume(v); },
    /** The file chosen in the panel's Changes for a view, while the panel shows it. @param {string} v */
    chosen(v) { return S.open && !fr.changes.folded && frames().includes("changes") ? CX.chosen(v) : null; },
    /** The app's theme switched: drawn diffs follow. @param {string} t */
    theme: (t) => changesFrame.theme(t),
    /** The place's name for the title bar (app.js knows the names). @param {(v: string) => string} fn */
    set names(fn) { nameOf = fn; },
    /** Is this element inside the panel (so the app's Esc leaves it alone)? @param {Node | null} node */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel, or closes it. No dot: nothing blinks here. */
    button(v = view()) {
      if (!place(v)) return "";
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: threads, changes and map" title="Threads, Changes and Map">${PANEL_IC}</button>`;
    },
  };
}
