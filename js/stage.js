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
//   · Launchpad, above them all (js/launchpad.js): folded to its head, it says where the project's deploy
//     stands; the header's Deploy opens it, and while it's open it has the stack and the others keep their
//     heads (their own folds are kept for when it closes).
//
// Made left the panel for the sidebar's Artifacts (another thread). The panel owns its frame: a 40 px
// title bar (the place, full size, close), its width (dragged, 320–720, kept), whether it's open (kept),
// the page making room for it (body.stage-open, body.stage-full), and floating over the conversation
// when that would get too narrow (body.stage-over).
//
// app.js calls: button, toggle, open, close, sync, isOpen, owns.

import { ICON, $ } from "./ui.js";
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
export function createStage({ map, files, changes, openFiles = null, viewer, view, go, announce, onChange, frames = () => ORDER, launch = null, threads = null, shell = null }) {
  const saved = sget(KEY);
  // the Map starts folded, in its Graph (the owner, 19 Nov): Threads and Changes have the room
  const fr = { changes: { folded: false }, agents: { rows: null, folded: false, groups: { done: true } }, map: { h: MAP_H, folded: true }, ...sget(FR_KEY) };
  if (!fr.agents.groups) fr.agents.groups = { done: true };
  if (!fr.map.h) fr.map.h = MAP_H;
  // a height dragged before Agents went by rows (any pixel count, so a row could show in half): its rows
  if (fr.agents.h) { fr.agents.rows = Math.max(1, Math.min(8, Math.round((fr.agents.h - 44) / ROW))); delete fr.agents.h; }
  const S = { lp: false, open: false, full: false, returnTo: null, wide: false, stackH: 0, h: { agents: "", changes: "", head: "", chn: "" } };

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel: threads, changes and map");
  const frame = (id, title, acts = "") => `<section class="fr" data-fr="${id}" aria-labelledby="fr-title-${id}"><header class="fr-h"><h2 class="fr-title" id="fr-title-${id}">${title}${id !== "map" ? `<span class="fr-n" data-fr-n="${id}"></span>` : ""}</h2><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-${id}"${id === "map" ? ' role="tabpanel"' : ""}></div></section>`;
  const gutter = (a, b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts">${shell ? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false" title="A shell here, in the panel" aria-label="Shell in the panel">${ICON.shell}</button>` : ""}<button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-page stg-shell"></div>` +
    `<div class="stg-frames">` +
    `<section class="fr fr-lp is-folded" data-fr="launch" aria-labelledby="fr-title-launch" hidden><header class="fr-h"><h2 class="fr-title" id="fr-title-launch">Launchpad</h2><span class="lp-hs"></span><div class="fr-a"><span class="lp-ha"></span><button type="button" class="fr-ib fr-fold" data-fr-fold="launch" aria-expanded="false" title="Open">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-launch" tabindex="-1"></div><div class="fr-ghosts" role="group" aria-label="Under Launchpad"></div></section><div class="fr-line" data-lp-line hidden></div>` +
    // its search filters the list here, in place (the owner, 19 Nov 15:04Z: "can't it search within?"), not a sheet
    frame("agents", "Threads", `<button type="button" class="fr-ib" data-tg-find aria-controls="fr-body-agents" title="Filter threads (/)" aria-label="Filter threads" aria-keyshortcuts="/">${ICON.search}</button>`) + gutter("agents", "changes") +
    frame("changes", "Changes", `<button type="button" class="xd-follow" data-follow hidden></button><button type="button" class="fr-ib" data-open-files title="All files">${FILES_IC}</button>`) + gutter("changes", "map") +
    frame("map", "Map", `<div class="fr-views" role="tablist" aria-label="Map view"><button type="button" class="fr-t" role="tab" id="stage-map-tree" aria-controls="fr-body-map" data-map-mode="tree">Diagram</button><button type="button" class="fr-t" role="tab" id="stage-map-graph" aria-controls="fr-body-map" data-map-mode="graph">Graph</button></div>`) +
    `</div>`;
  $("#main").appendChild(el);
  // the stack's height, as laid out (the panel opening, the window resizing): Agents' cap is worked out from it
  // when it changes, in the observer, after layout, instead of a read forcing layout in the middle of a change
  if (typeof ResizeObserver === "function") new ResizeObserver(([e]) => { const h = Math.round(e.contentRect.height); if (h !== S.stackH) { S.stackH = h; if (S.open) capAgents(); } }).observe(el.querySelector(".stg-frames"));
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
  const LPF = el.querySelector('[data-fr="launch"]');
  if (launch) launch.mount(LPF, { open: () => openLaunch(), hide: () => { S.lp = false; layout(); paint(); } });
  // Changes: Space's list and diff, or (where Space has no /changes yet) today's list
  body("changes").innerHTML = `<div class="cx-host"></div><div class="ch-old" hidden></div>`;
  const CX = createChangesFrame({
    host: body("changes").firstElementChild, changes, view,
    openFile: (s, path, from) => viewer.open({ path, name: path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${path}` : path, show: "changes" }, from),
    onChange: () => onChange && onChange(),
  });

  function persist() { sset(KEY, { open: S.open }); sset(FR_KEY, fr); }

  // ── the frames: folded or open, their heights ───────────────────────────────
  function layout() {
    // the shape's frames: one it doesn't keep is gone, with the line beside it
    const keep = new Set(frames());
    if (!keep.size) keep.add("agents");
    const on = (id) => keep.has(id);
    for (const id of ORDER) {
      el.querySelector(`[data-fr="${id}"]`).hidden = !on(id);
    }
    // Launchpad: there for a project that can deploy; open, it has the stack and the others show their heads
    // (only while it's open: folded, it isn't a standing row; the header's Deploy opens it, the owner 19 Nov)
    const lpCan = !!(launch && launch.has(view()));
    if (!lpCan) S.lp = false;
    const lpOn = lpCan && S.lp;
    LPF.hidden = !lpOn;
    el.querySelector("[data-lp-line]").hidden = !lpOn;
    LPF.classList.toggle("is-folded", !S.lp);
    LPF.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(S.lp));
    LPF.querySelector("[data-fr-fold]").title = S.lp ? "Fold" : "Open";
    // classes on the frames themselves, never on the panel: a class on the panel with rules below it restyled every
    // element in it (6,900 with a diff open) on each fold
    LPF.classList.toggle("is-open", S.lp);
    pressDeploy();
    el.querySelector('[data-gut="agents|changes"]').hidden = !(on("agents") && (on("changes") || on("map")));
    el.querySelector('[data-gut="changes|map"]').hidden = !(on("changes") && on("map"));
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`), folded = !!fr[id].folded;
      // covered by an open Launchpad: out of the accessibility tree (an attribute no style reads, so nothing restyles;
      // `inert` restyled the whole diff, 7,400 elements, on every fold and unfold), and focus that wanders in goes back
      if (S.lp) f.setAttribute("aria-hidden", "true"); else f.removeAttribute("aria-hidden");
      untab(f, S.lp);
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
    if (fr.map.folded || S.lp || !on("map") || !S.open) map.hide(); else map.show(view());
  }

  /** Agents is as tall as its rows, up to its count of them (3, or what you dragged to), and never more than
   *  the stack has room for once Changes keeps a whole file row and its diff and the Map its height; past
   *  that it scrolls a row at a time. */
  function capAgents() {
    const keep = new Set(frames()), on = (id) => keep.has(id) || (!keep.size && id === "agents");
    const ag = el.querySelector('[data-fr="agents"]');
    let rows = fr.agents.rows || AG_ROWS, cap = 8;
    // with Launchpad open Agents is only a head: nothing to size. The stack's height comes from its resize
    // observer, never a read here, which forced the page's layout mid-change (17–35 ms at 4×)
    const room = S.lp ? 0 : S.stackH - (LPF.hidden ? 0 : HEAD + 1);
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

  /** Launchpad open is drawn over the frames below its head, which stay laid out at their own sizes beneath it
   *  (css/launchpad.css: content-visibility hidden keeps their rendering), so folding it shows them again without
   *  laying out a whole diff (Changes with a file open, 4× CPU: ~250 → ~95 ms). Their heads show at its foot as
   *  they would folded: copies of the real ones, kept current here; a click on one folds Launchpad and opens it. */
  function ghosts() {
    const g = LPF.querySelector(".fr-ghosts");
    // each a real button, named "Open Changes, 47 +514 −78": the copy inside is only its look (its controls turned
    // to spans, their hooks dropped), so Tab goes Launchpad → these → out of the panel and a click opens that frame
    const NAME = { changes: "Changes", agents: "Threads", map: "Map" };
    const html = !S.lp ? "" : ORDER.filter((id) => !el.querySelector(`[data-fr="${id}"]`).hidden).map((id) => {
      const f = el.querySelector(`[data-fr="${id}"]`), n = f.querySelector(`[data-fr-n="${id}"]`)?.textContent.trim();
      const look = f.querySelector(":scope > .fr-h").innerHTML
        .replace(/<(\/?)(button|h2)\b/g, "<$1span").replace(/ (id|aria-[a-z]+|title|role|tabindex|type|data-[a-z-]+)="[^"]*"/g, "");
      return `<button type="button" class="fr-ghost" data-ghost="${id}" aria-label="Open ${NAME[id]}${n ? `, ${esc(n)}` : ""}"><span class="fr-ghost-v" aria-hidden="true">${look}</span></button>`;
    }).join("");
    // drawn in place (js/redraw.js): a frame's head button you're on stays the same button as its count moves (a live
    // agent 1 → 2 → 3 replaced it, and focus fell to the page: the controls grader on 9d1f71b, C072–C074)
    if (g._h !== html) { redraw(g, html); g._h = html; LPF.style.setProperty("--ghosts", `${g.children.length * HEAD}px`); }
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
      const mark = r.state === "working" ? '<i class="arc"></i>' : r.state === "needs" ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : r.state === "done" ? `<i class="ag-wait ag-done">${ICON.check}</i>` : "";
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
      `<span class="ag-ic" style="--c:${esc(a.color)}" aria-hidden="true">${ICON.threadOne}${a.waiting ? `<i class="ag-wait">${ICON.pause}</i>` : a.busy ? '<i class="arc"></i>' : ""}</span><span class="ag-t"><b>${esc(a.title)}</b><span class="ag-activity"><span class="ag-doing">${esc(a.doing)}</span></span></span>` +
      `<span class="ag-tm">${a.busy && Number.isFinite(a.since) ? `<span class="elapsed" data-since="${a.since}">${ago(a.since)}</span>` : ""}</span></button></li>`).join("")}</ul>`;
  }
  function changesHtml(list) {
    if (!list.length) return `<p class="fr-none">${view() === "home" || view() === "ws" ? "Open a project or thread to see what its agents changed." : "Nothing changed here yet."}</p>`;
    return `<ul class="ch-list">${list.map((x) => {
      const slash = x.path.lastIndexOf("/"), name = x.path.slice(slash + 1), dir = slash >= 0 ? x.path.slice(0, slash) : "";
      return `<li><button type="button" class="ch-r" data-change="${esc(x.rel)}" data-change-project="${esc(x.project)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="ch-i">${fileIcon(x.path)}</span><span class="ch-copy"><span class="ch-n">${esc(name)}</span>${dir ? `<span class="ch-path">${esc(dir)}</span>` : ""}</span><span class="ch-m m-${esc(x.live ? "live" : x.mark)}">${esc(x.live ? "editing" : x.mark)}</span></button></li>`;
    }).join("")}</ul>`;
  }
  /** The panel's name, and the place it's showing beside it, quieter (the owner, 6 Nov). Who's at work is
   *  Agents' own head, so it isn't said here too. */
  function titleHtml() {
    // the panel says the place it's beside (the owner, 19 Nov: not "Agentic Control Pane"); in Shell mode, "› Shell"
    const place = nameOf(view());
    const cur = S.page && PAGES.get(S.page.name);
    const titleOf = (t) => { const sp = PAGES.get(t.name), k = sp.single ? (S.single?.[t.name] ?? t.key) : t.key; return sp.title ? sp.title(k) : t.name; };
    // ‹ Sections leads any page but the shell (its own button is its way back, as before), with a dot when the
    // sections need you (an ask in Threads)
    const back = S.page && S.page.name !== "shell" ? `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to Threads, Changes and Map (Esc)" aria-label="Sections${sectionsNeed() ? ", something needs you" : ""}">${ICON.back}${sectionsNeed() ? '<i class="pg-dot" aria-hidden="true"></i>' : ""}</button>` : "";
    // a page's own lead control (Files: show or hide its file list), first after ‹ Sections, where you look first
    const lead = cur && cur.lead ? cur.lead(S.page.key) || "" : "";
    // on the sections, what the pages keep (a file in Files, a thread) stays one click away as its tab, beside the place
    // (‹ Sections or Esc from a file keeps it: the plan, FILES-IN-PANEL.md §2)
    if (S.tabs.length > 1 || (!S.page && S.tabs.length)) return `${S.page ? (back || `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to Threads, Changes and Map (Esc)" aria-label="Sections">${ICON.back}</button>`) + lead : `<b class="stg-name" title="${esc(place || "")}">${esc(place || "Panel")}</b>`}<span class="pg-tabs" role="tablist" aria-label="Open in the panel">${S.tabs.map((t) => {
      const on = sameTab(t, S.page), sp = PAGES.get(t.name), tt = titleOf(t);
      return `<button type="button" class="pg-tab${on ? " is-on" : ""}" role="tab" aria-selected="${on}" data-stg-tab="${esc(t.name)}" data-stg-key="${esc(t.key)}" title="${esc(tt)}">${sp.icon ? sp.icon(t.key) : ""}<span>${esc(tt)}</span></button>`; }).join("")}</span>`;
    if (cur && back) return `${back}${lead}<b class="stg-name" title="${esc(titleOf(S.page))}">${esc(titleOf(S.page))}</b>`;
    return `<b class="stg-name" title="${esc(place || "")}">${esc(place || "Panel")}</b>${cur ? `<span class="stg-sub">${esc(titleOf(S.page))}</span>` : ""}`;
  }
  let nameOf = () => "";

  function paint() {
    if (!S.open) return;
    const v = view();
    const ag = map.agents(v);
    // a clock's figures aren't a change (the app's ticker moves them each second): without this the Agents list was
    // rewritten every paint, and every rewrite re-added its arcs for ui.js to put back in step
    // drawn in place (js/redraw.js), so the row you're on in Agents or Changes stays itself as the list moves live
    const set = (k, node, html) => { const same = html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1"); if (S.h[k] !== same) { redraw(node, html); S.h[k] = same; } };
    set("head", el.querySelector(".stg-t"), titleHtml());
    if (launch && !LPF.hidden) launch.paint(v, S.lp);
    // under Launchpad Threads is a head: its list waits
    const tg = threads ? threads(v) : null;
    const tq = (S.tq || "").trim().toLowerCase(), total = tg ? tg.reduce((n, x) => n + x.rows.length, 0) : 0;
    const qBox = body("agents").querySelector(".tg-q");
    qBox.hidden = !(tg && (total > FILTER_AT || tq || S.tqOpen));
    if (!S.lp) set("agents", body("agents").querySelector(".tg-box"), tg ? threadsHtml(tg, tq) : agentsHtml(ag));
    // the threads, not the coordinator's row: the same count as the header's Threads (app.js threadCounts)
    el.querySelector('[data-fr-n="agents"]').textContent = tg ? (tg.reduce((n, x) => n + x.rows.filter((r) => !r.coord).length, 0) || "") : (ag.filter((a) => a.busy).length || "");
    // Changes: Space's list and diff where it has /changes, else today's list
    const cxOn = !fr.changes.folded && !S.lp && CX.paint();
    const hd = CX.head();
    const [cxHost, old] = body("changes").children;
    cxHost.hidden = !hd; old.hidden = !!hd;
    if (!hd && !S.lp) { const ch = files.changes(v); set("changes", old, changesHtml(ch)); }
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
      const fh = hd.follow ? `${hd.busy ? '<i class="xd-arc" aria-hidden="true"></i>' : ""}<span>Following</span>` : "<span>Follow</span>";
      if (fw._h !== fh) { redraw(fw, fh); fw._h = fh; } // in place: its label stays the node a press is on
      fw.classList.toggle("is-on", hd.follow);
      fw.setAttribute("aria-pressed", String(hd.follow));
      fw.title = hd.follow ? "Following the agent: the file it changes shows here. Pick a file or scroll to stop." : "Follow the agent: show each file it changes as it changes it";
    }
    // the panel keeps its width while Launchpad is open: folding Changes under it mustn't narrow the panel and
    // reflow the whole conversation (560 ↔ 360 px on every fold and unfold, found timing it)
    if (!S.lp && S.wide !== (cxOn && CX.wide)) { S.wide = cxOn && CX.wide; apply(); }
    for (const b of el.querySelectorAll("[data-map-mode]")) { const on = map.mode === b.dataset.mapMode; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
    body("map").setAttribute("aria-labelledby", `stage-map-${map.mode}`);
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    ghosts(); // last: the heads it copies are current by now
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
    if (!quiet) S.lp = false; // closed by you: Launchpad is a head again next time; stepping aside (quiet) keeps it as it was
    if (S.full) setFull(false);
    el.hidden = true;
    coverSync(); // what it covered is in reach again before focus goes back to it
    document.body.classList.remove("stage-open");
    launch && launch.away && launch.away(); // typed secrets don't stay behind in a closed panel (Astra)
    pressDeploy();
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

  /** The header's Deploy: the panel opens (if it isn't) with Launchpad open on top. */
  function openLaunch() {
    S.lp = true;
    S.lpOpened = !S.open; // pressed again, Deploy puts things back as they were: the panel closed, or Launchpad folded
    if (!S.open) open({ focus: false }); else { layout(); paint(); }
    // focus goes into the section, so Esc closes the panel rather than leaving the thread (Astra on 761119f); in
    // the same step the panel opens, since on a phone it covers Deploy and puts it out of reach (the browser run:
    // a frame later, focus had already fallen to the page); once more next frame if it wasn't drawn yet
    const into = () => LPF.querySelector(".fr-b")?.focus?.({ preventScroll: true });
    into();
    if (!LPF.contains(document.activeElement)) requestAnimationFrame(into);
  }

  /** The header's Deploy shows Launchpad open as pressed. Set here, where it changes, rather than by redrawing the
   *  app: the header's next draw writes the same state (app.js asks launchOpen), so the two never disagree. */
  function pressDeploy() {
    const on = S.open && S.lp;
    for (const b of document.querySelectorAll("[data-lp-open]")) { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); }
  }

  function setFull(on) {
    S.full = on;
    document.body.classList.toggle("stage-full", on);
    paint();
    coverSync();
  }

  function toggle() { if (S.open) close(); else open(); }
  // ── Pages (one panel model: the Files plan and the Thread page, 19 Nov; the Files thread's seven edits folded in)
  // The panel shows its sections, or one page in their place. A kind is registered once:
  //   page(name, { title(key), icon(key), width, single,
  //                mount(host, key)   once, when its tab first shows (host is the page's own box, kept),
  //                onShow(key, {focus}) / onHide(key)   every switch; hidden, a page lives on (Files keeps its
  //                                     editor, undo and caret),
  //                unmount(key)       when its tab closes,
  //                canClose(key)      → true | false | Promise<boolean>: asked before its tab's ×, the panel's ×
  //                                     or Esc closing it, and an eviction,
  //                escape(key)        → true when it took Esc (its find bar, a question, an old version) })
  // single: one tab for the kind, its key what it shows now (Files' own inner tabs); else a tab per key (threads).
  // show(name, key, {focus}) opens or brings forward; sections() goes back, tabs kept; closeTab(name, key) asks
  // first (a Promise<boolean>). dataset.page and --sw change in one write, nothing measured between.
  const PAGES = new Map(), BOXES = new Map();
  const TAB_MAX = 5;
  Object.assign(S, { page: null, tabs: [] });
  const sameTab = (a, b) => !!a && !!b && a.name === b.name && a.key === b.key;
  const tabOf = (name, key) => { const sp = PAGES.get(name); return { name, key: sp && sp.single ? name : String(key) }; };
  function page(name, spec) { PAGES.set(name, spec); }
  /** A page kind's own box in the host: made on its first show, hidden while another shows, gone with its tab. */
  function boxFor(t) {
    const id = `${t.name}\u0000${t.key}`;
    let b = BOXES.get(id);
    if (!b) { b = document.createElement("div"); b.className = "stg-pg"; b.dataset.pg = t.name; el.querySelector(".stg-page").append(b); BOXES.set(id, b); b._new = true; }
    return b;
  }
  const ask = async (t) => { const sp = PAGES.get(t.name); try { return !sp.canClose || (await sp.canClose(t.key)) !== false; } catch { return false; } };
  function show(name, key = name, { focus = false } = {}) {
    const sp = PAGES.get(name);
    if (!sp) return false;
    const next = tabOf(name, key), shownKey = String(key);
    if (!S.tabs.some((t) => sameTab(t, next))) { S.tabs.push(next); evict(next); }
    if (sp.single) S.single = { ...(S.single || {}), [name]: shownKey }; // what the one tab shows now (its title)
    if (!S.open) open({ focus: false });
    const was = S.page;
    if (!sameTab(was, next)) {
      if (was) { PAGES.get(was.name).onHide?.(was.key); boxFor(was).hidden = true; }
      // one write: the switch and the width, nothing measured between (the Files thread)
      S.page = next;
      el.dataset.page = name;
      el.classList.toggle("is-shell", name === "shell");
      if (S.full !== !!S.fullOf?.[name]) setFull(!!S.fullOf?.[name]); // full size belongs to the page
      apply();
      const box = boxFor(next);
      box.hidden = false;
      if (box._new) { box._new = false; sp.mount(box, next.key); }
    }
    sp.onShow?.(shownKey, { focus });
    pageChanged();
    return true;
  }
  /** Over TAB_MAX: the oldest tab that isn't showing goes if it lets itself; a page that refuses is skipped; when
   *  every one refuses, nothing goes. */
  async function evict(keep) {
    let n = S.tabs.length - TAB_MAX;
    for (const t of [...S.tabs]) {
      if (n <= 0) break;
      if (sameTab(t, S.page) || sameTab(t, keep)) continue;
      if (await ask(t)) { drop(t); n--; }
    }
    if (n < S.tabs.length - TAB_MAX + 1) pageChanged();
  }
  function sections({ paint: draw = true } = {}) {
    if (!S.page) return;
    const t = S.page;
    // focus in the page (a file, Esc from it) or on its head (‹ Sections itself, which goes with it) doesn't fall to the
    // page's body: it goes to that page's tab, else the panel
    const had = el.contains(document.activeElement);
    PAGES.get(t.name).onHide?.(t.key);
    boxFor(t).hidden = true;
    S.fullOf = { ...(S.fullOf || {}), [t.name]: S.full };
    S.page = null;
    delete el.dataset.page;
    el.classList.remove("is-shell");
    if (S.full) setFull(false); // the sections come back at their own width
    apply();
    if (draw) pageChanged();
    if (had && S.open) (el.querySelector(`[data-stg-tab="${CSS.escape(t.name)}"], [data-stg-page="${CSS.escape(t.name)}"]`) || el).focus({ preventScroll: true });
  }
  /** A tab goes: its page's own ×, or more than TAB_MAX. Asked first (canClose); refused, it stays. */
  async function closeTab(name, key = name) {
    const t = S.tabs.find((x) => sameTab(x, tabOf(name, key)));
    if (!t) return true;
    if (!(await ask(t))) return false;
    const was = sameTab(S.page, t);
    drop(t);
    if (was) { const prev = S.tabs[S.tabs.length - 1]; if (prev) show(prev.name, prev.key); else { delete el.dataset.page; el.classList.remove("is-shell"); if (S.full) setFull(false); apply(); pageChanged(); } }
    else pageChanged();
    return true;
  }
  function drop(t) {
    const sp = PAGES.get(t.name), id = `${t.name}\u0000${t.key}`;
    if (sameTab(S.page, t)) { sp.onHide?.(t.key); S.page = null; }
    sp.unmount?.(t.key);
    BOXES.get(id)?.remove(); BOXES.delete(id);
    S.tabs = S.tabs.filter((x) => x !== t);
  }
  /** The panel's × and Esc closing it: every open page is asked first (an unsaved file), then it closes. */
  async function requestClose() {
    for (const t of [...S.tabs]) if (!(await ask(t))) { if (!sameTab(S.page, t)) show(t.name, t.key, { focus: true }); return false; }
    close();
    return true;
  }
  /** Something in the sections needs you while a page is up: ‹ Sections says so (the Files thread). */
  const sectionsNeed = () => { const tg = threads ? threads(view()) : null; return !!tg && tg.some((g) => g.k === "needs" && g.rows.length); };
  function pageChanged() {
    const b = el.querySelector("[data-stg-shell]");
    if (b) { const on = S.page?.name === "shell"; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("is-on", on); b.title = on ? "Back to Threads, Changes and Map" : "A shell here, in the panel"; }
    S.h.head = ""; paint();
    onChange && onChange();
  }
  /** Shell mode (the owner, 19 Nov: a shell in the panel, the left panel's Shells as they are) is the page "shell":
   *  the shells' own dock, the same sessions and tabs, moved into the panel in place of its frames; app.js moves it
   *  (shell(on, host)). Hidden or closed, it goes back under the page, put away. */
  if (shell) page("shell", { title: () => "Shell", mount: () => {}, onShow: () => shell(true, boxFor(S.page)), onHide: () => shell(false), unmount: () => {} });
  function setShell(on) {
    if (!shell || (S.page?.name === "shell") === !!on) return;
    if (on) show("shell"); else closeTab("shell");
  }

  /** Every render: the frames follow the view. */
  function sync() {
    // what the cover holds inert follows the page as it changes
    if (S.open || document.querySelector("[data-stage-inert]")) coverSync();
    if (!S.open) return;
    apply();
    if (LPF.hidden === !!(launch && launch.has(view()) && S.lp)) layout();
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
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
  // focus that lands in a frame Launchpad covers moves on: forward (from Launchpad or its heads) out of the panel,
  // backward (from beyond the panel) to the last of its heads. No loop: Tab always gets out.
  el.addEventListener("focusin", (e) => {
    if (!S.lp || LPF.contains(e.target) || !e.target.closest?.(".stg-frames")) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) {
      // the panel is last on the page: past it, Tab comes round to the page's first control, as it would
      const next = focusAfter(el) || focusAfter(document.body.firstElementChild, true);
      if (next) next.focus({ preventScroll: true }); else e.target.blur();
    } else (LPF.querySelector(".fr-ghost:last-child") || LPF.querySelector(".fr-b"))?.focus({ preventScroll: true });
  });
  /** A covered frame's controls out of the tab order while Launchpad covers it, and back as they were after: just
   *  those controls, so nothing restyles (inert restyled the whole diff). Controls in a shadow root (the diff's)
   *  aren't reached here; the focus guard above moves on from them. */
  const TABBABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  function untab(frame, off) {
    if (off) {
      for (const x of frame.querySelectorAll(TABBABLE)) if (!x.hasAttribute("data-lp-tab")) { x.setAttribute("data-lp-tab", x.getAttribute("tabindex") ?? ""); x.tabIndex = -1; }
    } else {
      for (const x of frame.querySelectorAll("[data-lp-tab]")) { const was = x.getAttribute("data-lp-tab"); if (was === "") x.removeAttribute("tabindex"); else x.setAttribute("tabindex", was); x.removeAttribute("data-lp-tab"); }
    }
  }

  /** The first control after `node` in the page's order (Tab's next stop past it), or from it when `from`; or null. */
  function focusAfter(node, from = false) {
    const FOCUS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(FOCUS)].find((x) => (from ? node.contains(x) || (node.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) : !node.contains(x) && (node.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING))
      && !el.contains(x) && x.getClientRects().length && !x.closest("[inert],[hidden],[aria-hidden='true']")) || null;
  }
  // Esc: a search clears first; then full size steps back, then the panel closes
  el.addEventListener("keydown", (e) => {
    if (e.target.closest?.("[data-map-mode]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const tabs = [...el.querySelectorAll("[data-map-mode]")], index = tabs.indexOf(e.target.closest("[data-map-mode]"));
      const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); tabs[next].click(); return;
    }
    // / in the panel goes to the Threads filter when it shows (elsewhere / still writes, keys.js "write")
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
      const room = S.stackH - (LPF.hidden ? 0 : HEAD + 1), lines = [...el.querySelectorAll(".fr-gut")].filter((g) => !g.hidden).length;
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

  // ── width: flush to the window's right edge, 360 px by default, 320–720 by dragging its left edge ─
  const W_KEY = "xo-stage-w", W_DEF = 360, W_MIN = 320, W_MAX = 720;
  // a diff wants room for code: with one showing, the panel widens to WIDE while the conversation keeps READ
  // (never past a width you dragged it to yourself)
  const WIDE = 560;
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
  if (typeof ResizeObserver === "function" && document.querySelector(".side")) new ResizeObserver(() => { sideWv = null; }).observe(document.querySelector(".side"));
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(W_MAX, innerWidth - 480, w)));
  let wSaved = W_DEF, wMine = false;
  try { wMine = !!Number(localStorage.getItem(W_KEY)); wSaved = Number(localStorage.getItem(W_KEY)) || W_DEF; } catch { /* private mode */ }
  // a page with a width of its own (a file 640, a thread 560) keeps it apart from the sections': 480 up to the window
  // less READ for the conversation beside it, the width you dragged it to kept per page kind
  const PAGE_MIN = 480;
  // a page's default width: a number, or a function of the room it has (the window less the sidebar less the
  // conversation's own READ): a thread page's reads at the chat's measure where that fits
  const pageSpecW = () => { const w = S.page && PAGES.get(S.page.name)?.width; return (typeof w === "function" ? w({ room: innerWidth - sideW() - READ }) : w) || 0; };
  // (a phone: the panel is its full-screen sheet, so a page is the window's width)
  const clampP = (w) => (innerWidth <= 760 ? innerWidth : Math.round(Math.max(PAGE_MIN, Math.min(innerWidth - READ, w))));
  const pageW = () => { let v = 0; try { v = Number(localStorage.getItem(`${W_KEY}:${S.page.name}`)) || 0; } catch { v = 0; } return clampP(v || pageSpecW()); };
  const widthNow = () => (pageSpecW() ? pageW() : S.wide && !wMine && innerWidth - sideW() - WIDE >= READ ? Math.max(clampW(wSaved), clampW(WIDE)) : clampW(wSaved));
  function apply() {
    const v = widthNow();
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  const setW = (w, save = false) => {
    if (pageSpecW()) {
      const v = clampP(w);
      try { if (save) localStorage.setItem(`${W_KEY}:${S.page.name}`, String(v)); else S.dragW = v; } catch { /* private mode */ }
      document.documentElement.style.setProperty("--sw", `${v}px`);
      return v;
    }
    wSaved = clampW(w);
    if (save) { wMine = true; try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  setW(wSaved);
  addEventListener("resize", () => { apply(); coverSync(); if (S.open) capAgents(); });
  const grip = el.querySelector(".stg-grip");
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || S.full) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (ev) => { wMine = true; setW(right - ev.clientX); };
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(pageSpecW() ? S.dragW || pageW() : wSaved, true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => {
    if (pageSpecW()) { try { localStorage.removeItem(`${W_KEY}:${S.page.name}`); } catch { /* private mode */ } apply(); return; }
    wMine = false; try { localStorage.removeItem(W_KEY); } catch { /* private mode */ } setW(W_DEF);
  });
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW(wSaved + (e.key === "ArrowLeft" ? 16 : -16), true);
  });

  if (saved.open) requestAnimationFrame(() => open({ focus: false }));

  return {
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
    /** The header's Threads (the owner, 19 Nov 14:50Z: with the panel open it did nothing): the panel open on its
     *  Threads whatever it showed. Shell mode and Launchpad give way, Threads unfolds, its list comes to its top,
     *  focus lands on its first thread and its head glows once, so the press always answers. */
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
    /** Pages (see "Pages" above): register a kind, show one, back to the sections, close a tab, what's open. */
    page, show, sections, closeTab, requestClose,
    pages: () => S.tabs.map((t) => ({ ...t, title: PAGES.get(t.name).title?.(t.key) || t.name, on: sameTab(t, S.page) })),
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
    /** A changed file's chip: the panel opens (if closed) on that file's diff; false when it can't. */
    showChange(path) {
      if (!frames().includes("changes") || !CX.head()) return false;
      if (!CX.select(path)) return false;
      fr.changes.folded = false;
      // a page in front (a file in Files, a thread): the sections come back to show it, the page kept as its tab
      if (S.page) sections({ paint: false });
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
    button() {
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: threads, changes and map" title="Threads, Changes and Map">${PANEL_IC}</button>`;
    },
  };
}
