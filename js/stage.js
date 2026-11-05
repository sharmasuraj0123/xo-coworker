// The panel: one right-hand column of stacked frames, in the manner of Premiere Pro's panels (the owner,
// 4 November): no tab strip, but frames one above the other, each with its own 40 px head,
// each folding to that head, the line between two frames dragged to give one of them room.
//
//   · Changes, on top: every file the place changed with its +/− counts, then the chosen file's diff
//     (js/changesframe.js, from Space's /changes; the owner's design, 5 November). It follows the agent
//     until you touch it. Where Space has no /changes yet, today's list (js/files.js changes()), whose
//     rows open the file in Files. "All files" opens Files on its own.
//   · Agents: who is at work in this view, on what, for how long (js/map.js agents()), just above the Map,
//     so who sits next to where.
//   · Map: where they are, as a Diagram or a Graph (js/map.js, mounted here; its tabs are the frame's).
//
//   · Launchpad, above them all (js/launchpad.js): folded to its head, it says where the project's deploy
//     stands; the header's Deploy opens it, and while it's open it has the stack and the others keep their
//     heads (their own folds are kept for when it closes).
//
// Made left the panel for the sidebar's Artifacts (another thread). The panel owns its frame: a 40 px
// title bar (the place, full size, close), its width (dragged, 320–720, kept), whether it's open (kept),
// the page making room for it (body.stage-open, body.stage-full), and floating over the conversation
// when that would get too narrow (body.stage-over). While Files is open and the reader would drop under
// 560 px, the panel folds to a 40 px rail (body.stage-rail); a rail icon opens it again.
//
// app.js calls: button, toggle, open, close, sync, isOpen, owns.

import { ICON, $ } from "./ui.js";
import { esc } from "./util.js";
import { fileIcon } from "./fileicons.js";
import { createChangesFrame, countsHtml } from "./changesframe.js";
import { setTheme as diffTheme } from "./diffview.js";
import { LP_ICON } from "./launchpad.js";

const KEY = "xo-stage";
const FR_KEY = "xo-stage-frames-2"; // Changes · Agents · Map (the order before it kept "xo-stage-frames")
const PANEL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M14.5 4.5v15"/><path d="M17 8.5h1.5M17 11.5h1.5"/></svg>';
const FULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const UNFULL_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>';
const FOLD_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const AGENTS_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.4c1.6.7 2.6 2.3 3 4.6"/></svg>';
const CHANGES_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M9.5 13.5l2 2 3.5-4"/></svg>';
const FILES_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 18V6.5A1.5 1.5 0 0 1 5 5h4l2 2h8A1.5 1.5 0 0 1 20.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/></svg>';

const sget = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const ago = (ms) => { if (!Number.isFinite(ms)) return ""; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`; };

/**
 * map: the Map (mount, show, hide, render, live, agents, mode, setMode), mapIcon. files: js/files.js
 * (changes, today's list). changes: js/changes.js (Space's /changes). filesView: js/filesview.js (open,
 * isOpen). viewer: the file viewer. view(): the view on screen. go(view): navigate. onChange(): the app
 * re-renders (header buttons). frames(): the frames the person's shape keeps (xo:panel/*), of "changes",
 * "agents", "map"; the order stays the panel's own, since each line between two frames sizes a known pair.
 */
const ORDER = ["changes", "agents", "map"];
const MAP_H = 260, MAP_MIN = 72;
// Agents is sized in whole rows, never a row cut in half: up to AG_ROWS by default, 1–8 as the line above
// it is dragged; a row and the gap under it are ROW px (css/panel.css, .stage .ag-r)
const AG_ROWS = 3, ROW = 48;
// Agents never takes the room Changes needs: its 40 px head, one 32 px file row and the list's 8 px foot,
// the diff's 120 px and its 12 px margin (css/diffs.css). In a short window Agents shows fewer rows
const CH_MIN = 212, HEAD = 40;
export function createStage({ map, mapIcon, files, changes, filesView, viewer, view, go, announce, onChange, frames = () => ORDER, launch = null }) {
  const saved = sget(KEY);
  const fr = { changes: { folded: false }, agents: { rows: null, folded: false }, map: { h: MAP_H, folded: false }, ...sget(FR_KEY) };
  if (!fr.map.h) fr.map.h = MAP_H;
  // a height dragged before Agents went by rows (any pixel count, so a row could show in half): its rows
  if (fr.agents.h) { fr.agents.rows = Math.max(1, Math.min(8, Math.round((fr.agents.h - 44) / ROW))); delete fr.agents.h; }
  const S = { lp: false, open: false, full: false, returnTo: null, railOff: false, rail: false, aside: false, yielded: false, wide: false, h: { agents: "", changes: "", head: "", chn: "" } };

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel");
  const frame = (id, title, acts = "") => `<section class="fr" data-fr="${id}" aria-labelledby="fr-title-${id}"><header class="fr-h"><h2 class="fr-title" id="fr-title-${id}">${title}${id !== "map" ? `<span class="fr-n" data-fr-n="${id}"></span>` : ""}</h2><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-${id}"${id === "map" ? ' role="tabpanel"' : ""}></div></section>`;
  const gutter = (a, b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts"><button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-rail" aria-label="Panel, folded"><button type="button" class="stg-ic" data-rail="launch" title="Launchpad">${LP_ICON.rocket}</button><button type="button" class="stg-ic" data-rail="changes" title="Changes">${CHANGES_IC}</button><button type="button" class="stg-ic" data-rail="agents" title="Agents">${AGENTS_IC}</button><button type="button" class="stg-ic" data-rail="map" title="Map">${mapIcon}</button></div>` +
    `<div class="stg-frames">` +
    `<section class="fr fr-lp is-folded" data-fr="launch" aria-labelledby="fr-title-launch" hidden><header class="fr-h"><h2 class="fr-title" id="fr-title-launch">Launchpad</h2><span class="lp-hs"></span><div class="fr-a"><span class="lp-ha"></span><button type="button" class="fr-ib fr-fold" data-fr-fold="launch" aria-expanded="false" title="Open">${FOLD_IC}</button></div></header><div class="fr-b" id="fr-body-launch"></div></section><div class="fr-line" data-lp-line hidden></div>` +
    frame("changes", "Changes", `<button type="button" class="xd-follow" data-follow hidden></button><button type="button" class="fr-ib" data-open-files title="All files">${FILES_IC}</button>`) + gutter("changes", "agents") +
    frame("agents", "Agents") + gutter("agents", "map") +
    frame("map", "Map", `<div class="fr-views" role="tablist" aria-label="Map view"><button type="button" class="fr-t" role="tab" id="stage-map-tree" aria-controls="fr-body-map" data-map-mode="tree">Diagram</button><button type="button" class="fr-t" role="tab" id="stage-map-graph" aria-controls="fr-body-map" data-map-mode="graph">Graph</button></div>`) +
    `</div>`;
  $("#main").appendChild(el);
  const body = (id) => el.querySelector(`[data-fr="${id}"] .fr-b`);
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
    // the shape's frames: one it doesn't keep is gone, with its rail icon and the line beside it
    const keep = new Set(frames());
    if (!keep.size) keep.add("agents");
    const on = (id) => keep.has(id);
    for (const id of ORDER) {
      el.querySelector(`[data-fr="${id}"]`).hidden = !on(id);
      el.querySelector(`[data-rail="${id}"]`).hidden = !on(id);
    }
    // Launchpad: there for a project that can deploy; open, it has the stack and the others show their heads
    const lpOn = !!(launch && launch.has(view()));
    if (!lpOn) S.lp = false;
    LPF.hidden = !lpOn;
    el.querySelector("[data-lp-line]").hidden = !lpOn;
    el.querySelector('[data-rail="launch"]').hidden = !lpOn;
    LPF.classList.toggle("is-folded", !S.lp);
    LPF.classList.toggle("is-grow", S.lp);
    LPF.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(S.lp));
    LPF.querySelector("[data-fr-fold]").title = S.lp ? "Fold" : "Open";
    el.classList.toggle("is-lp", S.lp);
    el.querySelector('[data-gut="changes|agents"]').hidden = !(on("changes") && (on("agents") || on("map")));
    el.querySelector('[data-gut="agents|map"]').hidden = !(on("agents") && on("map"));
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`), folded = !!fr[id].folded || S.lp;
      f.classList.toggle("is-folded", folded);
      f.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(!folded));
      f.querySelector("[data-fr-fold]").title = folded ? "Open" : "Fold";
    }
    // Changes takes the room that's left; when it folds (or the shape has none), the Map; else Agents
    const grow = S.lp ? null : ["changes", "map", "agents"].find((id) => on(id) && !fr[id].folded);
    for (const id of ORDER) {
      const f = el.querySelector(`[data-fr="${id}"]`);
      f.classList.toggle("is-grow", grow === id);
      const h = id === "map" ? fr.map.h : null;
      f.style.height = fr[id].folded || grow === id || !h ? "" : `${h}px`;
    }
    capAgents();
    if (fr.map.folded || S.lp || !on("map") || !S.open || S.rail) map.hide(); else map.show(view());
  }

  /** Agents is as tall as its rows, up to its count of them (3, or what you dragged to), and never more than
   *  the stack has room for once Changes keeps a whole file row and its diff and the Map its height; past
   *  that it scrolls a row at a time. */
  function capAgents() {
    const keep = new Set(frames()), on = (id) => keep.has(id) || (!keep.size && id === "agents");
    const ag = el.querySelector('[data-fr="agents"]');
    let rows = fr.agents.rows || AG_ROWS, cap = 8;
    // with Launchpad open Agents is only a head: nothing to size, and no layout read under the section's first draw
    const room = S.lp ? 0 : el.querySelector(".stg-frames").clientHeight - (LPF.hidden ? 0 : HEAD + 1);
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
  function titleHtml(list) {
    const v = view();
    const busy = list.filter((a) => a.busy).length;
    return `<b class="stg-name">${esc(nameOf(v))}</b><span class="stg-sub">${busy ? `${busy} at work` : "No one at work"}</span>`;
  }
  let nameOf = () => "";

  function paint() {
    if (!S.open) return;
    const v = view();
    const ag = map.agents(v);
    const set = (k, node, html) => { if (S.h[k] !== html) { node.innerHTML = html; S.h[k] = html; } };
    set("head", el.querySelector(".stg-t"), titleHtml(ag));
    if (launch && !LPF.hidden) launch.paint(v, S.lp && !S.rail);
    set("agents", body("agents"), agentsHtml(ag));
    el.querySelector('[data-fr-n="agents"]').textContent = ag.filter((a) => a.busy).length || "";
    // Changes: Space's list and diff where it has /changes, else today's list
    const cxOn = !fr.changes.folded && !S.lp && CX.paint();
    const hd = CX.head();
    const [cxHost, old] = body("changes").children;
    cxHost.hidden = !hd; old.hidden = !!hd;
    if (!hd) { const ch = files.changes(v); set("changes", old, changesHtml(ch)); }
    const n = el.querySelector('[data-fr-n="changes"]');
    set("chn", n, hd ? (hd.count ? `${hd.count}${hd.total.add || hd.total.del ? ` ${countsHtml(hd.total)}` : ""}` : "") : String(files.changes(v).length || ""));
    const fw = el.querySelector("[data-follow]");
    fw.hidden = !hd || !hd.count;
    if (hd) {
      const fh = hd.follow ? `${hd.busy ? '<i class="xd-arc" aria-hidden="true"></i>' : ""}<span>Following</span>` : "<span>Follow</span>";
      if (fw._h !== fh) { fw.innerHTML = fh; fw._h = fh; }
      fw.classList.toggle("is-on", hd.follow);
      fw.setAttribute("aria-pressed", String(hd.follow));
      fw.title = hd.follow ? "Following the agent: the file it changes shows here. Pick a file or scroll to stop." : "Follow the agent: show each file it changes as it changes it";
    }
    if (S.wide !== (cxOn && CX.wide)) { S.wide = cxOn && CX.wide; apply(); }
    for (const b of el.querySelectorAll("[data-map-mode]")) { const on = map.mode === b.dataset.mapMode; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
    body("map").setAttribute("aria-labelledby", `stage-map-${map.mode}`);
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  function open({ focus = true } = {}) {
    // asked for while a file sits beside the chat: the right column is the panel's again, the file waits
    if (filesView.docked) { filesView.minimise({ chip: false }); S.aside = false; }
    if (!S.open) {
      S.open = true;
      S.returnTo = document.activeElement;
      el.hidden = false;
      el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in");
      document.body.classList.add("stage-open");
    }
    S.railOff = true; // opened on purpose: shown whole, even beside Files
    S.yielded = false;
    fitRail();
    layout();
    paint();
    persist();
    if (focus) el.focus({ preventScroll: true });
    onChange && onChange();
  }

  function close({ restore = true, quiet = false } = {}) {
    if (!S.open) return;
    S.open = false;
    if (!quiet) S.lp = false; // closed by you: Launchpad is a head again next time; stepping aside (quiet) keeps it as it was
    if (S.full) setFull(false);
    el.hidden = true;
    document.body.classList.remove("stage-open", "stage-rail");
    S.rail = false;
    map.hide();
    persist();
    const back = S.returnTo || document.querySelector("[data-stage-toggle]");
    S.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    if (!quiet) announce("Panel closed.");
    onChange && onChange();
  }

  /** The header's Deploy: the panel opens (if it isn't) with Launchpad open on top. */
  function openLaunch() {
    S.lp = true;
    S.lpOpened = !S.open; // pressed again, Deploy puts things back as they were: the panel closed, or Launchpad folded
    if (!S.open || S.rail) open({ focus: false }); else { layout(); paint(); }
    requestAnimationFrame(() => LPF.querySelector(".fr-b")?.focus?.({ preventScroll: true }));
    onChange && onChange();
  }

  function setFull(on) {
    S.full = on;
    document.body.classList.toggle("stage-full", on);
    paint();
  }

  function toggle() { if (S.open && !S.rail) close(); else open(); }

  /** Every render: the frames follow the view; the rail follows Files. */
  function sync() {
    // the panel steps aside while Files covers a phone, and while a file sits beside the chat (the right
    // column holds one thing: the chat); it comes back as it was when the file goes
    const aside = filesView.isOpen && (innerWidth <= 760 || filesView.docked);
    if (aside !== S.aside) {
      S.aside = aside;
      if (aside && S.open) { S.yielded = true; close({ restore: false, quiet: true }); return; }
      if (!aside && S.yielded) { S.yielded = false; if (!S.open) open({ focus: innerWidth <= 760 }); }
    }
    if (!S.open) return;
    fitRail();
    if (LPF.hidden === !!(launch && launch.has(view()))) layout();
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-stg-close]")) { close(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); return; }
    const rl = t.closest("[data-rail]");
    if (rl) { S.railOff = true; if (rl.dataset.rail === "launch") S.lp = true; else { S.lp = false; fr[rl.dataset.rail].folded = false; } fitRail(); layout(); paint(); persist(); return; }
    const fo = t.closest("[data-fr-fold]");
    if (fo) {
      const id = fo.dataset.frFold;
      if (id === "launch") S.lp = !S.lp;
      else if (S.lp) { S.lp = false; fr[id].folded = false; } // a head under an open Launchpad opens its frame
      else fr[id].folded = !fr[id].folded;
      layout(); paint(); persist(); onChange && onChange(); return;
    }
    // Launchpad's head, folded: anywhere on it opens it (its links and buttons do their own thing)
    if (t.closest('[data-fr="launch"] .fr-h') && !S.lp && !t.closest("a,button")) { S.lp = true; layout(); paint(); onChange && onChange(); return; }
    const mm = t.closest("[data-map-mode]");
    if (mm) { if (fr.map.folded) { fr.map.folded = false; layout(); } map.setMode(mm.dataset.mapMode); paint(); return; }
    if (t.closest("[data-open-files]")) { filesView.open(); return; }
    if (t.closest("[data-follow]")) { CX.toggleFollow(); paint(); return; }
    const ch = t.closest("[data-change]");
    if (ch) { const rel = ch.dataset.change; viewer.open({ path: rel, name: rel.split("/").pop(), project: ch.dataset.changeProject, rel }, ch); return; }
    const g = t.closest("[data-go]");
    if (g) { go(g.dataset.go); }
  });
  // Esc: a search clears first; then full size steps back, then the panel closes
  el.addEventListener("keydown", (e) => {
    if (e.target.closest?.("[data-map-mode]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const tabs = [...el.querySelectorAll("[data-map-mode]")], index = tabs.indexOf(e.target.closest("[data-map-mode]"));
      const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); tabs[next].click(); return;
    }
    if (e.key !== "Escape") return;
    if (e.target.closest && e.target.closest("input:not(.lp-in)") && e.target.value) return; // a search clears first; Launchpad's fields don't
    e.preventDefault(); e.stopPropagation();
    if (S.full) setFull(false); else close();
  }, true);

  // the line between two frames: drag it (or ↑ ↓ on it) to give one of them room
  for (const g of el.querySelectorAll("[data-gut]")) {
    const [a, b] = g.dataset.gut.split("|");
    let acc = 0; // Agents: the drag that isn't a whole row yet
    // the frame below the line gives or takes the room (dragging down shrinks it); the growing frame
    // (Changes, or the Map when Changes is folded) has the rest. When the frame below is the one growing,
    // the frame above sizes instead.
    const sized = () => (el.querySelector(`[data-fr="${b}"]`).classList.contains("is-grow") ? { id: a, sign: 1 } : { id: b, sign: -1 });
    const resize = (dy) => {
      const { id, sign } = sized();
      const f = el.querySelector(`[data-fr="${id}"]`);
      if (id === "agents") {
        // a row at a time, once the drag passes half a row; from the rows on screen when there are fewer
        acc += sign * dy;
        const shown = f.querySelectorAll(".ag-r").length;
        let rows = Math.min(S.agRows || AG_ROWS, Math.max(1, shown));
        const was = rows;
        while (acc >= ROW / 2) { rows++; acc -= ROW; }
        while (acc <= -ROW / 2) { rows--; acc += ROW; }
        // no taller than its agents need, nor than the room Changes and the Map leave it
        rows = Math.max(1, Math.min(8, Math.max(shown, AG_ROWS), S.agCap || 8, rows));
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
      acc = 0;
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
      acc = 0;
      // Agents steps a row; the Map 16 px
      const step = sized().id === "agents" ? ROW : 16;
      resize(e.key === "ArrowDown" ? step : -step);
      persist();
    });
    g.addEventListener("dblclick", () => { fr.agents.rows = null; fr.map.h = MAP_H; layout(); persist(); });
  }

  // ── width: flush to the window's right edge, 360 px by default, 320–720 by dragging its left edge ─
  const W_KEY = "xo-stage-w", W_DEF = 360, W_MIN = 320, W_MAX = 720, RAIL = 40;
  // a diff wants room for code: with one showing, the panel widens to WIDE while the conversation keeps READ
  // (never past a width you dragged it to yourself)
  const WIDE = 560;
  // when the conversation beside it would drop under READ px, the panel floats over it (with a shadow)
  // instead of squeezing it: a cut-down thread title is worse than a covered margin
  const READ = 560;
  const RAIL_READ = 520; // beside Files, the reader keeps at least this much; under it the panel folds to its rail
  const sideW = () => { const side = document.querySelector(".side"); return side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0; };
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(W_MAX, innerWidth - 480, w)));
  let wSaved = W_DEF, wMine = false;
  try { wMine = !!Number(localStorage.getItem(W_KEY)); wSaved = Number(localStorage.getItem(W_KEY)) || W_DEF; } catch { /* private mode */ }
  const widthNow = () => (S.wide && !wMine && innerWidth - sideW() - WIDE >= READ ? Math.max(clampW(wSaved), clampW(WIDE)) : clampW(wSaved));
  function apply() {
    const v = S.rail ? RAIL : widthNow();
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", !S.rail && innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  const setW = (w, save = false) => {
    wSaved = clampW(w);
    if (save) { wMine = true; try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  /** Beside Files, a wide panel folds to its rail so the reader keeps 560 px, unless you opened it. */
  function fitRail() {
    const tw = filesView.isOpen ? (parseFloat(getComputedStyle(document.querySelector("#fv") || document.body).getPropertyValue("--tw")) || 280) : 0;
    if (!filesView.isOpen) S.railOff = false;
    const want = S.open && filesView.isOpen && !S.railOff && innerWidth > 760 && innerWidth - sideW() - widthNow() - tw < RAIL_READ;
    if (want !== S.rail) {
      S.rail = want;
      document.body.classList.toggle("stage-rail", want);
      layout();
    }
    apply();
  }
  setW(wSaved);
  addEventListener("resize", () => { fitRail(); if (S.open) capAgents(); });
  const grip = el.querySelector(".stg-grip");
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || S.full || S.rail) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (ev) => { wMine = true; setW(right - ev.clientX); };
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(wSaved, true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => { wMine = false; try { localStorage.removeItem(W_KEY); } catch { /* private mode */ } setW(W_DEF); });
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW(wSaved + (e.key === "ArrowLeft" ? 16 : -16), true);
  });

  if (saved.open) requestAnimationFrame(() => open({ focus: false }));

  return {
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
    /** The header's Deploy. */
    launch() {
      if (!(S.open && S.lp && !S.rail)) { openLaunch(); return; }
      if (S.lpOpened) close(); else { S.lp = false; layout(); paint(); onChange && onChange(); }
    },
    /** Is Launchpad open in the panel (the header's Deploy reads as pressed)? */
    get launchOpen() { return S.open && S.lp && !S.rail; },
    /** The shape changed: the frames it keeps, at once. */
    reshape() { layout(); paint(); },
    /** A changed file's chip: the panel opens (if closed) on that file's diff; false when it can't. */
    showChange(path) {
      if (!frames().includes("changes") || !CX.head()) return false;
      if (!CX.select(path)) return false;
      fr.changes.folded = false;
      if (!S.open || S.rail) open({ focus: false }); else { layout(); paint(); persist(); }
      return true;
    },
    /** You sent the agent a message: following resumes (D6). */
    resumeFollow(v) { CX.resume(v); },
    /** The file chosen in the panel's Changes for a view, while the panel shows it (its chip reads as chosen). */
    chosen(v) { return S.open && !S.rail && !fr.changes.folded && frames().includes("changes") ? CX.chosen(v) : null; },
    /** The app's theme switched: drawn diffs follow. */
    theme: (t) => diffTheme(t),
    /** The place's name for the title bar (app.js knows the names). */
    set names(fn) { nameOf = fn; },
    /** Is this element inside the panel (so the app's Esc leaves it alone)? */
    owns: (node) => !!(node && el.contains(node)),
    /** The one header button: opens the panel, or closes it. No dot: nothing blinks here. */
    button() {
      return `<button type="button" class="stg-btn${S.open ? " is-on" : ""}" data-stage-toggle aria-pressed="${S.open}" aria-controls="stage" aria-label="Panel: agents, map and changes" title="Agents, Map and Changes">${PANEL_IC}</button>`;
    },
  };
}
