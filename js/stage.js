// The panel: one right-hand column of stacked frames, in the manner of Premiere Pro's panels (the owner,
// 4 November): no tab strip, but frames one above the other, each with its own 40 px head,
// each folding to that head, the line between two frames dragged to give one of them room.
//
//   (Threads on top, then Changes, then the Map: the owner, 19 Nov 13:42Z.)
//   · Changes: every file the place changed with its +/− counts, then the chosen file's diff
//     (js/changesframe.js, from Space's /changes; the owner's design, 5 November). It follows the agent
//     until you touch it. Where Space has no /changes yet, today's list (js/files.js changes()), whose
//     rows open the file in Files. "All files" opens Files on its own.
//   · Threads (the frame that was Agents; its id stays "agents" for the shape's xo:panel/agents): every thread of
//     the place, in one vocabulary (Needs you, Working, Waiting, Done), what each is on or what it did, and when.
//     A working thread says what it's doing now (js/map.js agents()); Done is folded (the owner, 19 Nov).
//   · Map: where they are, as a Diagram or a Graph (js/map.js, mounted here; its tabs are the frame's).
//
//
// Over the sections it shows one page at a time. The panel owns its frame: its head, its width (2/5 of the main area, or dragged and kept),
// whether it's open (kept),
// the page making room for it (body.stage-open, body.stage-full), and floating over the conversation
// when that would get too narrow (body.stage-over).
//
// app.js calls: button, toggle, open, close, sync, isOpen, owns.

import { ICON, ARC, xi, $ } from "./ui.js";
import { esc } from "./util.js";
import { redraw } from "./redraw.js";
import { usable } from "./focusview.js";
import { fileIcon } from "./fileicons.js";
import { createChangesFrame, countsHtml } from "./changesframe.js";
import { setTheme as diffTheme } from "./diffview.js";

const KEY = "xo-stage";
const FR_KEY = "xo-stage-frames-3"; // Threads · Changes · Map, the Map folded at first (the order before it kept "-2")
const PANEL_IC = ICON.panel;
const FULL_IC = ICON.full;
const UNFULL_IC = ICON.unfull;
const FOLD_IC = ICON.chevron;
const FILES_IC = ICON.folder;

const sget = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const ago = (ms) => { if (!Number.isFinite(ms)) return ""; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`; };

/**
 * map: the Map (mount, show, hide, render, live, agents, mode, setMode). files: js/files.js
 * (changes, today's list). changes: js/changes.js (Space's /changes). openFiles(): the panel's Files page (js/filespage.js;
 * "All files"). viewer: the file viewer. view(): the view on screen. go(view): navigate. onChange(): the app
 * re-renders (header buttons). frames(): the frames the person's shape keeps (xo:panel/*), of "changes",
 * "agents", "map"; the order stays the panel's own, since each line between two frames sizes a known pair.
 */
const ORDER = ["agents", "changes", "map"];
const MAP_H = 260, MAP_MIN = 72;
// Agents is sized in whole rows, never a row cut in half: up to AG_ROWS by default, 1–8 as the line above
// it is dragged; a row and the gap under it are ROW px (css/panel.css, .stage .ag-r)
const AG_ROWS = 6, ROW = 48; // Threads shows six rows at first (a list to read, not three live agents)
// Agents never takes the room Changes needs: its 40 px head, one 32 px file row and the list's 8 px foot,
// the diff's 120 px and its 12 px margin (css/diffs.css). In a short window Agents shows fewer rows
const CH_MIN = 212, HEAD = 40;
export function createStage({ map, files, changes, openFiles = null, github = null, viewer, view, go, announce, onChange, frames = () => ORDER, threads = null, shell = null, owns = () => false, place = () => true }) {
  const saved = sget(KEY);
  // the Map starts folded, in its Graph (the owner, 19 Nov): Threads and Changes have the room
  const fr = { changes: { folded: false }, agents: { rows: null, folded: false, groups: { done: true } }, map: { h: MAP_H, folded: true }, ...sget(FR_KEY) };
  if (!fr.agents.groups) fr.agents.groups = { done: true };
  if (!fr.map.h) fr.map.h = MAP_H;
  // a height dragged before Agents went by rows (any pixel count, so a row could show in half): its rows
  if (fr.agents.h) { fr.agents.rows = Math.max(1, Math.min(8, Math.round((fr.agents.h - 44) / ROW))); delete fr.agents.h; }
  const S = { lp: false, open: false, full: false, returnTo: null, stackH: 0, h: {} }; // h: the html paint last wrote to each region

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel: threads, changes and map");
  const FRAME_IC = { agents: "threads", changes: "changes", map: "map" };
  const frame = (id, title, acts = "") => `<section class="fr" data-fr="${id}" aria-labelledby="fr-title-${id}"><header class="fr-h"><h2 class="fr-title" id="fr-title-${id}">${xi(FRAME_IC[id], "fr-ic")}${title}${id !== "map" ? `<span class="fr-n" data-fr-n="${id}"></span>` : ""}</h2><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-${id}"${id === "map" ? ' role="tabpanel"' : ""}></div></section>`;
  const gutter = (a, b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts"><span class="stg-pa"></span>${github ? `<button type="button" class="stg-ic" data-open-gh aria-pressed="false" title="Issues and pull requests" aria-label="Issues and pull requests" hidden>${ICON.github}</button>` : ""}${openFiles ? `<button type="button" class="stg-ic" data-open-files aria-pressed="false" title="All files" aria-label="All files">${FILES_IC}</button>` : ""}${shell ? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false" title="A shell here, in the panel" aria-label="Shell in the panel">${ICON.shell}</button>` : ""}<button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-body"><div class="stg-frames">` +
    // its search filters the list here, in place (the owner, 19 Nov 15:04Z: "can't it search within?"), not a sheet
    frame("agents", "Threads", `<button type="button" class="fr-ib" data-tg-find aria-controls="fr-body-agents" title="Filter threads (/)" aria-label="Filter threads" aria-keyshortcuts="/">${ICON.search}</button>`) + gutter("agents", "changes") +
    frame("changes", "Changes", `<button type="button" class="xd-follow" data-follow hidden>${ICON.follow}</button>`) + gutter("changes", "map") +
    frame("map", "Map", `<div class="fr-views" role="tablist" aria-label="Map view"><button type="button" class="fr-t" role="tab" id="stage-map-tree" aria-controls="fr-body-map" data-map-mode="tree" title="Diagram" aria-label="Diagram">${ICON.map}</button><button type="button" class="fr-t" role="tab" id="stage-map-graph" aria-controls="fr-body-map" data-map-mode="graph" title="Graph" aria-label="Graph">${ICON.graph}</button></div>`) +
    `</div><div class="stg-page"></div></div>`;
  $("#main").appendChild(el);
  // the stack's height, as laid out (the panel opening, the window resizing): Agents' cap is worked out from it
  // when it changes, in the observer, after layout, instead of a read forcing layout in the middle of a change
  if (typeof ResizeObserver === "function") new ResizeObserver(([e]) => { const h = Math.round(e.contentRect.height); if (h !== S.stackH) { S.stackH = h; if (S.open) { capAgents(); edges(); } } }).observe(el.querySelector(".stg-frames"));
  // a list fills its frame to the foot, which fades while more of it is below
  const LISTS = '[data-fr="agents"] > .fr-b, .ch-old';
  const edge = (b) => b.classList.toggle("is-fade", b.scrollTop + b.clientHeight < b.scrollHeight - 1);
  let edgeF = 0;
  const edges = () => { if (!edgeF) edgeF = requestAnimationFrame(() => { edgeF = 0; for (const b of el.querySelectorAll(LISTS)) edge(b); }); };
  el.addEventListener("scroll", (e) => { if (e.target.matches?.(LISTS)) edge(e.target); }, { capture: true, passive: true });
  const body = (id) => el.querySelector(`[data-fr="${id}"] .fr-b`);
  // Threads' body: the filter field (kept, never redrawn under your typing) over the list (drawn in place)
  body("agents").innerHTML = `<div class="tg-q" hidden><label class="tg-qf">${ICON.search}<input type="search" data-tg-q placeholder="Filter threads" aria-label="Filter threads by title, summary or branch" aria-keyshortcuts="/" autocomplete="off" spellcheck="false"></label><kbd class="tg-k" aria-hidden="true">/</kbd></div><div class="tg-box"></div>`;
  {
    const inp = body("agents").querySelector("[data-tg-q]");
    inp.addEventListener("input", () => { S.tq = inp.value; paint(); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && inp.value) { e.preventDefault(); e.stopPropagation(); inp.value = ""; S.tq = ""; paint(); return; }
      // empty, Esc puts a field you opened away again (a long list keeps its field) and goes back to the search button
      if (e.key === "Escape" && S.tqOpen) { e.preventDefault(); e.stopPropagation(); S.tqOpen = false; paint(); el.querySelector("[data-tg-find]")?.focus({ preventScroll: true }); return; }
      if (e.key === "ArrowDown" || e.key === "Enter") { const r = body("agents").querySelector(".tg-box [data-go]"); if (r) { e.preventDefault(); if (e.key === "Enter") r.click(); else r.focus(); } }
    });
  }
  map.mount(body("map"));
  // Changes: Space's list and diff, or (where Space has no /changes yet) today's list
  body("changes").innerHTML = `<div class="cx-host"></div><div class="ch-old" hidden></div>`;
  const CX = createChangesFrame({
    host: body("changes").firstElementChild, changes, view,
    openFile: (s, path, from) => viewer.open({ path, name: path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${path}` : path, show: "changes" }, from),
    onChange: () => onChange && onChange(),
  });

  function persist() { sset(KEY, { open: S.open || !!S.resume }); sset(FR_KEY, fr); }
  // a place without a panel (the app says which have one): open elsewhere, it steps aside there and comes back with the next
  const placeless = () => !place(view());

  // ── the frames: folded or open, their heights ───────────────────────────────
  function layout() {
    // the shape's frames: one it doesn't keep is gone, with the line beside it
    const keep = new Set(frames());
    if (!keep.size) keep.add("agents");
    const on = (id) => keep.has(id);
    for (const id of ORDER) {
      el.querySelector(`[data-fr="${id}"]`).hidden = !on(id);
    }
    el.querySelector('[data-gut="agents|changes"]').hidden = !(on("agents") && (on("changes") || on("map")));
    el.querySelector('[data-gut="changes|map"]').hidden = !(on("changes") && on("map"));
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`), folded = !!fr[id].folded;
      f.classList.toggle("is-folded", folded);
      f.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(!folded));
      f.querySelector("[data-fr-fold]").title = folded ? "Open" : "Fold";
    }
    // Changes takes the room that's left; when it folds (or the shape has none), the Map; else Threads. While Changes
    // has nothing to show, Threads has the room (an empty Changes held most of the panel over a list cut to rows)
    const grow = (S.chEmpty ? ["agents", "changes", "map"] : ["changes", "map", "agents"]).find((id) => on(id) && !fr[id].folded);
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`);
      f.classList.toggle("is-grow", grow === id);
      const h = id === "map" ? fr.map.h : null;
      f.style.height = fr[id].folded || grow === id || !h ? "" : `${h}px`;
    }
    capAgents();
    if (fr.map.folded || !on("map") || !S.open) map.hide(); else map.show(view());
  }

  /** Agents is as tall as its rows, up to its count of them (3, or what you dragged to), and never more than
   *  the stack has room for once Changes keeps a whole file row and its diff and the Map its height; past
   *  that it scrolls a row at a time. */
  function capAgents() {
    const keep = new Set(frames()), on = (id) => keep.has(id) || (!keep.size && id === "agents");
    const ag = el.querySelector('[data-fr="agents"]');
    let rows = fr.agents.rows || AG_ROWS, cap = 8;
    // the stack's height comes from its resize observer, never a read here (a read forced layout mid-change)
    const room = S.stackH;
    if (room > 0 && on("agents") && !fr.agents.folded && !ag.classList.contains("is-grow")) {
      const grows = (id) => el.querySelector(`[data-fr="${id}"]`).classList.contains("is-grow");
      const changes = !on("changes") ? 0 : fr.changes.folded ? HEAD : CH_MIN;
      const mapH = !on("map") ? 0 : fr.map.folded ? HEAD : grows("map") ? 96 : fr.map.h;
      const lines = [...el.querySelectorAll(".fr-gut")].filter((g) => !g.hidden).length;
      cap = Math.max(1, Math.floor((room - changes - mapH - lines - 44) / ROW));
      rows = Math.min(rows, cap);
    }
    S.agRows = rows; S.agCap = cap;
    ag.style.setProperty("--ag-rows", rows);
  }

  // ── what the frames say ─────────────────────────────────────────────────────
  /** Threads: groups in one vocabulary, each folding on the frame's own fold axis; a row is the Agents row
   *  (tile, title, what it's on, when), its state the tile's corner mark: the arc while it works, the amber
   *  diamond when it needs you, a tick when it's done. Waiting shows its first few, then "Show N more". */
  const SHOW = { needs: Infinity, working: Infinity, waiting: 5, done: 5 };
  // a filter field once a place has more threads than this (the owner, 19 Nov 14:44Z: "the filter for long thread
  // list can be made"): it matches the title, the summary and the branch, every word; / in the panel focuses it,
  // Esc clears it; while it filters, every group shows all it matches
  const FILTER_AT = 12;
  const matchesQ = (r, q) => { const s = `${r.title} ${r.sub || ""} ${r.summary || ""} ${r.branch || ""}`.toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); };
  /** The search button and /: the Threads filter, shown (a short list hides it until asked) and focused. */
  function findThreads() {
    if (fr.agents.folded) { fr.agents.folded = false; persist(); layout(); }
    S.tqOpen = true; paint();
    const q = el.querySelector("[data-tg-q]"); q.focus({ preventScroll: true }); q.select();
  }
  function threadsHtml(groups, q = "") {
    if (q) {
      groups = groups.map((x) => ({ ...x, rows: x.rows.filter((r) => matchesQ(r, q)) })).filter((x) => x.rows.length);
      if (!groups.length) return `<p class="fr-none tg-none">No thread matches “${esc(q)}”. <button type="button" class="tg-clear" data-tg-clear>Clear the filter</button></p>`;
    }
    if (!groups || !groups.length) return `<p class="fr-none">No ${"threads"} here yet.</p>`;
    const g = q ? {} : fr.agents.groups || {}, more = q ? { needs: 1, working: 1, waiting: 1, done: 1 } : S.tgMore || {};
    const row = (r) => {
      const mark = r.state === "working" ? ARC : r.state === "needs" ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : r.state === "done" ? `<i class="ag-wait ag-done">${ICON.check}</i>` : "";
      return `<li><button type="button" class="ag-r${r.state === "working" || r.state === "needs" ? "" : " is-idle"}${r.on ? " is-on" : ""}"${r.on ? ' aria-current="page"' : ""} data-go="${esc(r.go)}" aria-label="${esc(`${r.title}. ${r.word}`)}">` +
        `<span class="ag-ic"${r.color ? ` style="--c:${esc(r.color)}"` : ""} aria-hidden="true">${r.coord ? ICON.project : ICON.threadOne}${mark}</span>` +
        `<span class="ag-t"><b>${esc(r.title)}</b><span class="ag-activity"><span class="ag-doing">${r.subHtml || esc(r.sub || r.word)}</span></span></span>` +
        // the right column: the time on the title's line, the agent's mark small under it on the summary's line
        `<span class="ag-tm"><span class="ag-when">${r.since ? `<span class="elapsed" data-since="${r.since}">${ago(r.since)}</span>` : esc(r.at || "")}</span>${r.mark ? `<span class="ag-mk">${r.mark}</span>` : ""}</span></button></li>`;
    };
    return `<ul class="ag-list tg-list">${groups.map((x) => {
      const folded = !!g[x.k], n = x.rows.length, cap = more[x.k] ? Infinity : SHOW[x.k] ?? 5;
      const head = `<li class="tg-h"><button type="button" class="tg-b" data-tg-fold="${x.k}" aria-expanded="${!folded}"><span class="tg-w">${esc(x.word)}</span><span class="fr-n">${n}</span><span class="tg-ch" aria-hidden="true">${FOLD_IC}</span></button></li>`;
      if (folded) return head;
      const shown = x.rows.slice(0, cap);
      return head + shown.map(row).join("") + (n > shown.length ? `<li class="tg-h"><button type="button" class="tg-b tg-more" data-tg-more="${x.k}" aria-expanded="false"><span class="tg-w">Show ${n - shown.length} more</span><span class="tg-ch" aria-hidden="true">${FOLD_IC}</span></button></li>` : "");
    }).join("")}</ul>`;
  }
  function agentsHtml(list) {
    if (!list.length) return `<p class="fr-none">No agent is working here right now.</p>`;
    return `<ul class="ag-list">${list.map((a) => `<li><button type="button" class="ag-r${a.busy ? "" : " is-idle"}${a.go === view() ? " is-on" : ""}"${a.go === view() ? ' aria-current="page"' : ""} data-go="${esc(a.go)}" title="Open ${esc(a.title)}">` +
      `<span class="ag-ic" style="--c:${esc(a.color)}" aria-hidden="true">${ICON.threadOne}${a.waiting ? `<i class="ag-wait">${ICON.pause}</i>` : a.busy ? ARC : ""}</span><span class="ag-t"><b>${esc(a.title)}</b><span class="ag-activity"><span class="ag-doing">${esc(a.doing)}</span></span></span>` +
      `<span class="ag-tm">${a.busy && Number.isFinite(a.since) ? `<span class="elapsed" data-since="${a.since}">${ago(a.since)}</span>` : ""}</span></button></li>`).join("")}</ul>`;
  }
  function changesHtml(list) {
    if (!list.length) return `<p class="fr-none">${view() === "home" || view() === "ws" ? "Open a project or thread to see what its agents changed." : "Nothing changed here yet."}</p>`;
    return `<ul class="ch-list">${list.map((x) => {
      const slash = x.path.lastIndexOf("/"), name = x.path.slice(slash + 1), dir = slash >= 0 ? x.path.slice(0, slash) : "";
      return `<li><button type="button" class="ch-r" data-change="${esc(x.rel)}" data-change-project="${esc(x.project)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="ch-i">${fileIcon(x.path)}</span><span class="ch-copy"><span class="ch-n">${esc(name)}</span>${dir ? `<span class="ch-path">${esc(dir)}</span>` : ""}</span><span class="ch-m m-${esc(x.live ? "live" : x.mark)}">${esc(x.live ? "editing" : x.mark)}</span></button></li>`;
    }).join("")}</ul>`;
  }
  // one head: on a page ‹, its lead control and its title; on the sections only the panel's controls
  function titleHtml() {
    if (!S.page) return ""; // the sections name no place: the chat beside them already does
    const sp = PAGES.get(S.page.name), title = pageTitle(S.page);
    const to = sp.backTo?.(S.page.key) || (S.under ? pageTitle(S.under) : "Threads, Changes and Map"), need = !S.under && sectionsNeed();
    const back = `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to ${esc(to)} (Esc)" aria-label="Back to ${esc(to)}${need ? ", something needs you" : ""}">${ICON.back}${need ? '<i class="pg-dot" aria-hidden="true"></i>' : ""}</button>`;
    const lead = sp.lead ? sp.lead(S.page.key) || "" : "";
    return `${back}${lead}<b class="stg-name" title="${esc(title)}">${esc(title)}</b>`;
  }
  let nameOf = () => "";

  // the page stack's marks on the panel: which page shows, and the head's Files and Shell pressed with it
  function reflect() {
    if (S.page) el.dataset.stgPage = S.page.name; else delete el.dataset.stgPage;
    const fb = el.querySelector("[data-open-files]");
    if (fb) { const on = S.page?.name === "files"; fb.setAttribute("aria-pressed", String(on)); fb.classList.toggle("is-on", on); }
    const gb = el.querySelector("[data-open-gh]");
    if (gb) { const on = /^gh/.test(S.page?.name || "") || S.page?.name === "github"; gb.setAttribute("aria-pressed", String(on)); gb.classList.toggle("is-on", on); }
    const b = el.querySelector("[data-stg-shell]");
    if (b) { const on = S.page?.name === "shell"; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("is-on", on); b.title = on ? (S.under ? `Back to ${pageTitle(S.under)}` : "Back to Threads, Changes and Map") : S.page?.name === "thread" ? "A shell in this thread's worktree" : "A shell here, in the panel"; }
  }
  function paint() {
    reflect();
    if (!S.open) return;
    const v = view();
    if (github) { const gb = el.querySelector("[data-open-gh]"); github.has(v).then((ok) => { if (gb.hidden === ok) gb.hidden = !ok; }); }
    const ag = map.agents(v);
    // a clock's figures aren't a change (the app's ticker moves them each second): without this the Agents list was
    // rewritten every paint, and every rewrite re-added its arcs for ui.js to put back in step
    // drawn in place (js/redraw.js), so the row you're on in Agents or Changes stays itself as the list moves live
    const set = (k, node, html) => { const same = html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1"); if (S.h[k] !== same) { redraw(node, html); S.h[k] = same; } };
    set("head", el.querySelector(".stg-t"), titleHtml());
    const tg = threads ? threads(v) : null;
    const tq = (S.tq || "").trim().toLowerCase(), total = tg ? tg.reduce((n, x) => n + x.rows.length, 0) : 0;
    const qBox = body("agents").querySelector(".tg-q");
    qBox.hidden = !(tg && (total > FILTER_AT || tq || S.tqOpen));
    // covered sections wait: back() paints them
    const covered = !!S.page;
    if (!covered) set("agents", body("agents").querySelector(".tg-box"), tg ? threadsHtml(tg, tq) : agentsHtml(ag));
    // the threads, not the coordinator's row: the same count as the header's Threads (app.js threadCounts)
    const fn = el.querySelector('[data-fr-n="agents"]'), cnt = String(tg ? (tg.reduce((n, x) => n + x.rows.filter((r) => !r.coord).length, 0) || "") : (ag.filter((a) => a.busy).length || ""));
    if (fn.textContent !== cnt) fn.textContent = cnt;
    // Changes: Space's list and diff where it has /changes, else today's list
    if (!fr.changes.folded && !covered) CX.paint();
    const hd = CX.head();
    const [cxHost, old] = body("changes").children;
    cxHost.hidden = !hd; old.hidden = !!hd;
    if (!hd && !covered) { const ch = files.changes(v); set("changes", old, changesHtml(ch)); }
    edges();
    const empty = hd ? !hd.count : !files.changes(v).length;
    if (S.chEmpty !== empty) {
      // files arriving open Changes under Threads (the owner, 19 Nov 13:42Z); a fold you made since stays
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
      fw.classList.toggle("is-on", hd.follow);
      fw.setAttribute("aria-pressed", String(hd.follow));
      fw.title = hd.follow ? "Following the agent: the file it changes shows here. Pick a file or scroll to stop." : "Follow the agent: show each file it changes as it changes it";
      fw.setAttribute("aria-label", hd.follow ? "Following the agent" : "Follow the agent");
    }
    for (const b of el.querySelectorAll("[data-map-mode]")) { const on = map.mode === b.dataset.mapMode; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
    body("map").setAttribute("aria-labelledby", `stage-map-${map.mode}`);
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  /** While the panel covers the page (full size, or any size on a phone) what's under it is out of reach: inert,
   *  so Tab never lands on a control you can't see (Astra C023: Tab reached the opener under a phone's panel).
   *  Only what this set inert is released; the toast stays reachable above it. */
  function coverSync() {
    const on = S.open && !el.hidden && (S.full || innerWidth <= 760);
    // notices stay in reach above it (a Stop's Undo, Launchpad's own): the herald, and the toast, are kept out of the
    // inert part, and drawn above the panel while it covers (css: body.stage-covers .herald)
    const keep = [document.getElementById("herald")].filter(Boolean);
    // what should be inert now, worked out whole each time; then whatever this marked before and shouldn't be is
    // released, wherever it is. The release followed the herald's path, and the herald moves (out of the folded chat
    // in Files, js/herald.js): the panel closed, the composer and the file's chip stayed inert under a path the walk no
    // longer took, and the message box couldn't be typed in (the controls grader on 9d1f71b, a phone, F08/F14, C029)
    const want = new Set();
    const walk = (root) => {
      for (const c of root.children) {
        if (c === el || c.classList.contains("toast-wrap") || keep.includes(c)) continue;
        if (keep.some((k) => c.contains(k))) walk(c);
        else want.add(c);
      }
    };
    // focus on what's about to be covered (the panel's own opener, when the window narrows to a phone's) goes into
    // the panel, never to the page (Files/Map grader on 875a2ab, C023: a resize to 390 left it on BODY)
    const a = document.activeElement, outside = !!a && a !== document.body && !el.contains(a) && !keep.some((k) => k.contains(a)) && !a.closest(".toast-wrap");
    if (on && el.parentElement) walk(el.parentElement);
    for (const n of document.querySelectorAll("[data-stage-inert]")) if (!want.has(n)) { n.inert = false; delete n.dataset.stageInert; }
    // only what isn't inert already is marked (another owner's inert, a folded chat's, stays its own)
    for (const n of want) if (!n.inert) { n.inert = true; n.dataset.stageInert = ""; }
    document.body.classList.toggle("stage-covers", on);
    if (on && (outside || document.activeElement === document.body) && (!a || a === document.body || !!a.closest("[inert]") || !a.isConnected)) el.focus({ preventScroll: true });
  }

  function open({ focus = true } = {}) {
    if (placeless()) return;
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
    if (S.page) dropPages();
    if (!S.open) return;
    S.open = false;
    if (S.full) setFull(false);
    el.hidden = true;
    coverSync(); // what it covered is in reach again before focus goes back to it
    document.body.classList.remove("stage-open");
    map.hide();
    persist();
    // back to what opened it, or, if that was redrawn meanwhile (the head's toggle is), to the toggle on screen now:
    // never to the page (Astra C069)
    const back = [S.returnTo, ...document.querySelectorAll("[data-stage-toggle]")].find(usable);
    S.returnTo = null;
    if (restore && back) back.focus({ preventScroll: true });
    // the head is redrawn after this (its toggle with it): once it has been, focus is on the toggle drawn now
    if (restore) requestAnimationFrame(() => requestAnimationFrame(() => { const a = document.activeElement; if (!a || a === document.body || !a.isConnected) [...document.querySelectorAll("[data-stage-toggle]")].find(usable)?.focus({ preventScroll: true }); }));
    if (!quiet) announce("Panel closed.");
    onChange && onChange();
  }

  function setFull(on) {
    S.full = on;
    document.body.classList.toggle("stage-full", on);
    paint();
    coverSync();
  }

  function toggle() { if (S.open) close(); else open(); }
  // ── Pages: one over the sections; a shell, or a page marked over, keeps the page under it; another place or closing drops them
  const PAGES = new Map(), BOXES = new Map();
  Object.assign(S, { page: null, under: null });
  const same = (a, b) => !!a && !!b && a.name === b.name && a.key === b.key;
  const pageTitle = (t) => { const sp = PAGES.get(t.name); return (sp.title && sp.title(t.key)) || t.name; };
  function page(name, spec) { PAGES.set(name, spec); }
  // one box per kind, built once
  function boxFor(name) {
    let b = BOXES.get(name);
    if (!b) { b = document.createElement("div"); b.className = "stg-pg"; b.dataset.pg = name; b.hidden = true; el.querySelector(".stg-page").append(b); BOXES.set(name, b); }
    return b;
  }
  // the slide: 12 px and a fade, --d-sheet and --ease
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  let motion = null;
  const tokens = () => { if (!motion) { const cs = getComputedStyle(document.documentElement); motion = { d: parseFloat(cs.getPropertyValue("--d-sheet")) || 240, ease: cs.getPropertyValue("--ease").trim() || "ease" }; } return motion; };
  const FROM = { opacity: 0, transform: "translateX(12px)" }, TO = { opacity: 1, transform: "none" };
  function slide(box, dir, done) {
    box.getAnimations().forEach((x) => x.cancel());
    const { d, ease } = tokens();
    const a = box.animate(dir === "in" ? [FROM, TO] : [TO, FROM], { duration: d, easing: ease });
    a.finished.then(() => done && done(), () => {});
  }
  // covered sections leave the rendering but stay laid out
  function cover(on) {
    if (!on) { el.classList.remove("is-covered"); return; }
    if (S.page) el.classList.add("is-covered");
  }
  function shut(t, shown) { const sp = PAGES.get(t.name); if (shown) sp.onHide?.(t.key); sp.close?.(t.key); }

  function show(name, key = name, { focus = false } = {}) {
    const sp = PAGES.get(name);
    if (!sp || placeless()) return false;
    const next = { name, key: String(key) }, fresh = !S.open;
    if (fresh) open({ focus: false });
    // same kind, another subject: the box stays
    if (S.page && S.page.name === name) { S.page = next; sp.onShow?.(next.key, { focus }); pageChanged(); return true; }
    const prev = S.page, keep = (name === "shell" || sp.over) && prev && !S.under ? prev : null;
    for (const t of [prev, S.under]) if (t && t !== keep) shut(t, t === prev);
    if (keep) PAGES.get(keep.name).onHide?.(keep.key);
    S.under = keep; S.page = next;
    const box = boxFor(name), old = prev ? BOXES.get(prev.name) : null;
    box.hidden = false;
    if (!box._m) { box._m = true; sp.mount?.(box, next.key); }
    sp.onShow?.(next.key, { focus });
    // opening with the panel, the panel's entrance is the motion
    const settle = () => { box.style.zIndex = ""; if (S.page && S.page.name === name) { if (old && old !== box) old.hidden = true; cover(true); } };
    if (fresh || RM.matches) settle(); else { box.style.zIndex = "1"; slide(box, "in", settle); }
    pageChanged();
    return true;
  }
  // ‹ and Esc: one level back
  function back() {
    if (!S.page) return;
    const t = S.page, under = S.under, box = BOXES.get(t.name);
    const from = document.activeElement, had = el.contains(from);
    if (under) BOXES.get(under.name).hidden = false; // shown before this one closes, so it can take focus back there
    shut(t, true);
    const keep = had && document.activeElement === from; // a page that put focus back itself keeps it there
    S.page = under; S.under = null;
    if (under) PAGES.get(under.name).onShow?.(under.key, { focus: keep }); else cover(false);
    box.style.zIndex = "1";
    const gone = () => { box.style.zIndex = ""; if (S.page?.name !== t.name) box.hidden = true; };
    if (RM.matches) gone(); else slide(box, "out", gone);
    pageChanged();
    if (keep && !under && S.open) el.focus({ preventScroll: true });
  }
  function dropPages() {
    if (!S.page) return;
    const t = S.page, under = S.under;
    shut(t, true); if (under) shut(under, false);
    for (const b of BOXES.values()) { b.getAnimations().forEach((x) => x.cancel()); b.hidden = true; b.style.zIndex = ""; }
    S.page = null; S.under = null;
    cover(false);
    pageChanged();
  }
  function closePage(name) {
    if (S.page?.name === name) back();
    else if (S.under?.name === name) { shut(S.under, false); BOXES.get(name).hidden = true; S.under = null; pageChanged(); }
  }
  // the panel's ×: an unsaved file asks first
  async function requestClose() {
    for (const t of [S.page, S.under].filter(Boolean)) {
      const sp = PAGES.get(t.name);
      let ok = true;
      try { ok = !sp.canClose || (await sp.canClose(t.key)) !== false; } catch { ok = false; }
      if (!ok) return false;
    }
    close();
    return true;
  }
  const sectionsNeed = () => { const tg = threads ? threads(view()) : null; return !!tg && tg.some((g) => g.k === "needs" && g.rows.length); };
  function pageChanged() { paint(); onChange && onChange(); }
  // over a thread the shell opens in its worktree
  if (shell) page("shell", {
    title: (k) => `Shell · ${S.under ? pageTitle(S.under) : nameOf(k || view())}`,
    onShow: (k) => shell(true, boxFor("shell"), k), onHide: () => shell(false),
  });
  function setShell(on) {
    if (!shell || (S.page?.name === "shell") === !!on) return;
    if (on) show("shell", S.page?.name === "thread" ? `t:${S.page.key}` : view()); else back();
  }

  /** Every render: the frames follow the view. */
  function sync() {
    if (placeless()) { if (S.open) { S.resume = true; close({ restore: false, quiet: true }); } }
    else if (S.resume) { S.resume = false; open({ focus: false }); }
    // what the cover holds inert follows the page as it changes
    if (S.open || document.querySelector("[data-stage-inert]")) coverSync();
    if (!S.open) return;
    apply();
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-stg-close]")) { requestClose(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); return; }
    if (t.closest("[data-stg-shell]")) { setShell(S.page?.name !== "shell"); return; }
    if (t.closest("[data-stg-sections]")) { if (!(S.page && PAGES.get(S.page.name).up?.(S.page.key) === true)) back(); return; }
    const pa = t.closest("[data-stg-act]");
    if (pa && S.page) { PAGES.get(S.page.name).act?.(pa.dataset.stgAct, pa); return; }
    const fo = t.closest("[data-fr-fold]");
    if (fo) {
      const id = fo.dataset.frFold;
      fr[id].folded = !fr[id].folded;
      layout(); paint(); persist(); return;
    }
    const mm = t.closest("[data-map-mode]");
    if (mm) { if (fr.map.folded) { fr.map.folded = false; layout(); } map.setMode(mm.dataset.mapMode); paint(); return; }
    if (t.closest("[data-open-gh]")) { if (S.page?.name === "github" || S.page?.name === "ghitem") { dropPages(); pageChanged(); } else github.show(); return; }
    if (t.closest("[data-open-files]")) { if (S.page?.name === "files") back(); else openFiles && openFiles(); return; }
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
  // Esc: a search clears first; then the page's own Esc, then one level back, then full size, then the panel closes
  el.addEventListener("keydown", (e) => {
    // inside the Shell page's terminal every key is the shell's (Esc for vim, / for less): the panel's Esc, tabs and /
    // leave it alone, by the shells' own rule (the app's keys ask the same one)
    if (owns(e)) return;
    if (e.target.closest?.("[data-map-mode]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const tabs = [...el.querySelectorAll("[data-map-mode]")], index = tabs.indexOf(e.target.closest("[data-map-mode]"));
      const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); tabs[next].click(); return;
    }
    // / in the panel goes to the Threads filter when it shows (elsewhere / still writes, keys.js "write")
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.("input, textarea, [contenteditable]")) {
      if (!S.page && !fr.agents.folded && el.querySelector('[data-fr="agents"]:not([hidden])')) { e.preventDefault(); e.stopPropagation(); findThreads(); return; }
    }
    if (e.key !== "Escape") return;
    if (e.target.closest && e.target.closest("input") && e.target.value) return; // a search clears first
    e.preventDefault(); e.stopPropagation();
    // the page first (its find bar, a question, an old version), then full size, then the sections, then closed
    if (S.page && PAGES.get(S.page.name).escape?.(S.page.key) === true) return;
    if (S.page) back(); else if (S.full) setFull(false); else requestClose();
  }, true);

  // the line between two frames: drag it (or ↑ ↓ on it) to give one of them room
  for (const g of el.querySelectorAll("[data-gut]")) {
    const [a, b] = g.dataset.gut.split("|");
    let acc = 0; // Agents: the drag that isn't a whole row yet
    let past = 0; // how far the pointer went on past where the Map stopped growing: the line waits for it to come back
    // the frame below the line gives or takes the room (dragging down shrinks it); the growing frame
    // (Changes, or the Map when Changes is folded) has the rest. When the frame below is the one growing,
    // the frame above sizes instead.
    const sized = () => (el.querySelector(`[data-fr="${b}"]`).classList.contains("is-grow") ? { id: a, sign: 1 } : { id: b, sign: -1 });
    // the Map, when it's there to take or give room: open, and not the frame that has the rest
    const mapSizes = () => { const m = el.querySelector('[data-fr="map"]'); return !m.hidden && !fr.map.folded && !m.classList.contains("is-grow"); };
    // the Map grows only into the room Changes can spare (its CH_MIN) with Agents' rows as they are: past that,
    // capAgents took a row from Agents and the line jumped back down, behind the pointer (Astra, on 3df29a4: a
    // phone, three agents). Capped there, the drag comes to a stop instead
    const mapTop = () => {
      const shown = (id) => !el.querySelector(`[data-fr="${id}"]`).hidden;
      const room = S.stackH, lines = [...el.querySelectorAll(".fr-gut")].filter((g) => !g.hidden).length;
      const changes = !shown("changes") ? 0 : fr.changes.folded ? HEAD : CH_MIN;
      // Agents' rows as they are on screen: its cap (3) when it has fewer agents would keep room for rows that
      // aren't there (Astra, on 47d871e: one agent, the line stopped 96 px short)
      const rows = Math.min(S.agRows || 1, Math.max(1, el.querySelectorAll('[data-fr="agents"] .ag-r').length));
      return room - changes - lines - 44 - rows * ROW;
    };
    const sizeMap = (d) => {
      const h = fr.map.h || MAP_H;
      fr.map.h = Math.max(MAP_MIN, Math.min(640, d > 0 ? Math.max(h, Math.min(h + d, mapTop())) : h + d));
    };
    const resize = (dy) => {
      const { id, sign } = sized();
      const f = el.querySelector(`[data-fr="${id}"]`);
      if (id === "agents") {
        // a row at a time, once the drag passes half a row; from the rows on screen when there are fewer. It's
        // never taller than its agents need, nor than the room Changes and the Map leave it
        let d = sign * dy;
        if (past && Math.sign(d) !== Math.sign(past)) { const back = Math.sign(d) * Math.min(Math.abs(d), Math.abs(past)); past += back; d -= back; if (!d) return; }
        const shown = f.querySelectorAll(".ag-r").length;
        const was = Math.min(S.agRows || AG_ROWS, Math.max(1, shown)), top = Math.max(1, Math.min(8, shown, S.agCap || 8));
        // past that, the line goes on moving: the Map under Agents takes the room or gives it (the owner, 6 Nov:
        // with one agent at work the line above Agents didn't move at all, while the Map's did)
        // (what the rows' snapping left the line ahead of the pointer is taken off first, so it stays under it)
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
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      let y0 = e.clientY;
      acc = 0; past = 0;
      document.body.classList.add("stage-vsizing");
      const move = (ev) => { resize(ev.clientY - y0); y0 = ev.clientY; };
      const up = () => { g.removeEventListener("pointermove", move); document.body.classList.remove("stage-vsizing"); persist(); };
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up, { once: true });
      g.addEventListener("pointercancel", up, { once: true });
    });
    g.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      acc = 0; past = 0;
      // Agents steps a row; the Map 16 px
      const step = sized().id === "agents" ? ROW : 16;
      resize(e.key === "ArrowDown" ? step : -step);
      persist();
    });
    g.addEventListener("dblclick", () => { fr.agents.rows = null; fr.map.h = MAP_H; layout(); persist(); });
  }

  // ── width: one for everything the panel shows; 2/5 of the main area until you drag it (the owner, 20 Nov: 3:2)
  const W_KEY = "xo-stage-w2", W_SHARE = 0.4, W_MIN = 320, CHAT_MIN = 480;
  // when the conversation beside it would drop under READ px, the panel floats over it (with a shadow)
  // instead of squeezing it: a cut-down thread title is worse than a covered margin
  const READ = 560;
  // the sidebar's width changes only when it's resized (the window, its collapse): read once then, not on every
  // change of the panel, where the read forced the page's layout in the middle of its own (24–88 ms at 4×)
  let sideWv = null;
  const sideW = () => {
    if (sideWv == null) { const side = document.querySelector(".side"); sideWv = side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0; }
    return sideWv;
  };
  addEventListener("resize", () => { sideWv = null; });
  if (typeof ResizeObserver === "function" && document.querySelector(".side")) new ResizeObserver(() => { sideWv = null; apply(); }).observe(document.querySelector(".side"));
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(innerWidth - sideW() - CHAT_MIN, w)));
  const wDef = () => (innerWidth - sideW()) * W_SHARE;
  let wSaved = 0;
  try { wSaved = Number(localStorage.getItem(W_KEY)) || 0; } catch { /* private mode */ }
  function apply() {
    const v = clampW(wSaved || wDef());
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  const setW = (w, save = false) => {
    wSaved = w ? clampW(w) : 0;
    if (save) { try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  apply();
  addEventListener("resize", () => { apply(); coverSync(); if (S.open) capAgents(); });
  const grip = el.querySelector(".stg-grip");
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || S.full) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (ev) => setW(right - ev.clientX);
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(wSaved || clampW(wDef()), true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => { try { localStorage.removeItem(W_KEY); } catch { /* private mode */ } setW(0); });
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW((wSaved || clampW(wDef())) + (e.key === "ArrowLeft" ? 16 : -16), true);
  });

  if (saved.open) S.resume = true; // opened by the first render of a place that has a panel

  return {
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
    /** The header's Threads (the owner, 19 Nov 14:50Z: with the panel open it did nothing): the panel open on its
     *  Threads whatever it showed. Shell mode gives way, Threads unfolds, its list comes to its top,
     *  focus lands on its first thread and its head glows once, so the press always answers. */
    threads() {
      if (S.page) dropPages();
      fr.agents.folded = false;
      open({ focus: false });
      persist(); layout(); paint();
      const f = el.querySelector('[data-fr="agents"]'), b = body("agents");
      b.scrollTop = 0;
      (b.querySelector(".tg-box [data-go]") || el.querySelector('[data-fr-fold="agents"]'))?.focus({ preventScroll: true });
      f.classList.remove("is-flash"); void f.offsetWidth; f.classList.add("is-flash");
    },
    get isShell() { return S.page?.name === "shell"; },
    shellOff: () => setShell(false),
    /** Pages (see "Pages" above): register a kind, show one, one level back, close one kind, the panel's ×. */
    page, show, back, closePage, requestClose,
    leave: () => dropPages(),
    get slot() { return el.querySelector(".stg-pa"); },
    get pageShown() { return S.page ? { ...S.page } : null; },
    /** A page's title or back label changed: its head is drawn again. */
    repaint: () => paint(),
    /** The shape changed: the frames it keeps, at once. */
    reshape() { layout(); paint(); },
    /** A changed file's chip: the panel opens (if closed) on that file's diff; false when it can't. */
    showChange(path) {
      if (!frames().includes("changes") || !CX.head()) return false;
      if (!CX.select(path)) return false;
      fr.changes.folded = false;
      if (S.page) dropPages();
      if (!S.open) open({ focus: false }); else { layout(); paint(); persist(); }
      return true;
    },
    /** You sent the agent a message: following resumes (D6). */
    resumeFollow(v) { CX.resume(v); },
    /** The file chosen in the panel's Changes for a view, while the panel shows it (its chip reads as chosen). */
    chosen(v) { return S.open && !fr.changes.folded && frames().includes("changes") ? CX.chosen(v) : null; },
    /** The app's theme switched: drawn diffs follow. */
    theme: (t) => diffTheme(t),
    /** The place's name for the title bar (app.js knows the names). */
    set names(fn) { nameOf = fn; },
    /** Is this element inside the panel (so the app's Esc leaves it alone)? */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel, or closes it. No dot: nothing blinks here. */
    button(v) {
      if (!place(v)) return "";
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: threads, changes and map" title="Threads, Changes and Map">${PANEL_IC}</button>`;
    },
  };
}
