// The panel: one right-hand column of stacked frames, in the manner of Premiere Pro's panels (the owner,
// 4 November): no tab strip, but frames one above the other, each with its own 32 px head and tabs,
// each folding to that head, the line between two frames dragged to give one of them room.
//
//   · Agents: who is at work in this view, on what, for how long (js/map.js agents()).
//   · Map: where they are, as a Diagram or a Graph (js/map.js, mounted here; its tabs are the frame's).
//   · Changes: what they changed (js/files.js changes()); a row opens the file in the main area, where
//     Files now lives (js/filesview.js). "All files" opens that place on its own.
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

const KEY = "xo-stage";
const FR_KEY = "xo-stage-frames";
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
 * (changes). filesView: js/filesview.js (open, isOpen). viewer: the file viewer. view(): the view on
 * screen. go(view): navigate. onChange(): the app re-renders (header buttons).
 */
export function createStage({ map, mapIcon, files, filesView, viewer, view, go, announce, onChange }) {
  const saved = sget(KEY);
  const fr = { agents: { h: null, folded: false }, map: { folded: false }, changes: { h: 200, folded: false }, ...sget(FR_KEY) };
  const S = { open: false, full: false, returnTo: null, railOff: false, rail: false, h: { agents: "", changes: "", head: "" } };

  const el = document.createElement("aside");
  el.className = "stage";
  el.id = "stage";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Panel");
  const frame = (id, tabs, acts = "") => `<section class="fr" data-fr="${id}"><header class="fr-h"><div class="fr-tabs" role="tablist" aria-label="${id}">${tabs}</div><div class="fr-a">${acts}<button type="button" class="fr-ib fr-fold" data-fr-fold="${id}" aria-expanded="true" title="Fold">${FOLD_IC}</button></div></header><div class="fr-b"></div></section>`;
  const gutter = (a, b) => `<div class="fr-gut" role="separator" aria-orientation="horizontal" aria-label="Resize ${a} and ${b}" data-gut="${a}|${b}" tabindex="0"></div>`;
  el.innerHTML = `<div class="stg-grip" role="separator" aria-orientation="vertical" aria-label="Resize the panel" title="Drag to resize · double-click for the default" tabindex="0"></div>` +
    `<header class="stg-bar"><div class="stg-t"></div><div class="stg-acts"><button type="button" class="stg-ic" data-stg-full></button><button type="button" class="stg-ic" data-stg-close aria-label="Close the panel" title="Close (Esc)">${ICON.close}</button></div></header>` +
    `<div class="stg-rail" aria-label="Panel, folded"><button type="button" class="stg-ic" data-rail="agents" title="Agents">${AGENTS_IC}</button><button type="button" class="stg-ic" data-rail="map" title="Map">${mapIcon}</button><button type="button" class="stg-ic" data-rail="changes" title="Changes">${CHANGES_IC}</button></div>` +
    `<div class="stg-frames">` +
    frame("agents", `<span class="fr-t is-on" role="tab" aria-selected="true">Agents<span class="fr-n" data-fr-n="agents"></span></span>`) + gutter("agents", "map") +
    frame("map", `<button type="button" class="fr-t" role="tab" data-map-mode="tree">Diagram</button><button type="button" class="fr-t" role="tab" data-map-mode="graph">Graph</button>`) + gutter("map", "changes") +
    frame("changes", `<span class="fr-t is-on" role="tab" aria-selected="true">Changes<span class="fr-n" data-fr-n="changes"></span></span>`, `<button type="button" class="fr-ib" data-open-files title="All files">${FILES_IC}</button>`) +
    `</div>`;
  $("#main").appendChild(el);
  const body = (id) => el.querySelector(`[data-fr="${id}"] .fr-b`);
  map.mount(body("map"));

  function persist() { sset(KEY, { open: S.open }); sset(FR_KEY, fr); }

  // ── the frames: folded or open, their heights ───────────────────────────────
  function layout() {
    for (const id of ["agents", "map", "changes"]) {
      const f = el.querySelector(`[data-fr="${id}"]`);
      f.classList.toggle("is-folded", !!fr[id].folded);
      f.querySelector("[data-fr-fold]").setAttribute("aria-expanded", String(!fr[id].folded));
      f.querySelector("[data-fr-fold]").title = fr[id].folded ? "Open" : "Fold";
    }
    const a = el.querySelector('[data-fr="agents"]'), c = el.querySelector('[data-fr="changes"]'), m = el.querySelector('[data-fr="map"]');
    a.style.height = fr.agents.folded ? "" : fr.agents.h ? `${fr.agents.h}px` : "";
    c.style.height = fr.changes.folded ? "" : `${fr.changes.h}px`;
    // when the Map folds, Changes takes the room that's left
    m.classList.toggle("is-grow", !fr.map.folded);
    c.classList.toggle("is-grow", !!fr.map.folded && !fr.changes.folded);
    if (fr.map.folded || !S.open || S.rail) map.hide(); else map.show(view());
  }

  // ── what the frames say ─────────────────────────────────────────────────────
  function agentsHtml(list) {
    if (!list.length) return `<p class="fr-none">No agent is working here right now.</p>`;
    return `<ul class="ag-list">${list.map((a) => `<li><button type="button" class="ag-r${a.busy ? "" : " is-idle"}" data-go="${esc(a.go)}" title="Open ${esc(a.title)}">` +
      `<span class="ag-sw" style="--c:${esc(a.color)}" aria-hidden="true"></span><span class="ag-t"><b>${esc(a.title)}</b><span>${esc(a.doing)}</span></span>` +
      `<span class="ag-tm">${a.busy && Number.isFinite(a.since) ? `<span class="elapsed" data-since="${a.since}">${ago(a.since)}</span>` : ""}</span></button></li>`).join("")}</ul>`;
  }
  function changesHtml(list) {
    if (!list.length) return `<p class="fr-none">${view() === "home" || view() === "ws" ? "Open a project or thread to see what its agents changed." : "Nothing changed here yet."}</p>`;
    return `<ul class="ch-list">${list.map((x) => `<li><button type="button" class="ch-r" data-change="${esc(x.rel)}" data-change-project="${esc(x.project)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="ch-i">${fileIcon(x.path)}</span><span class="ch-n">${esc(x.path)}</span><span class="ch-m m-${esc(x.live ? "live" : x.mark)}">${esc(x.live ? "editing" : x.mark)}</span></button></li>`).join("")}</ul>`;
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
    const ch = files.changes(v);
    const set = (k, node, html) => { if (S.h[k] !== html) { node.innerHTML = html; S.h[k] = html; } };
    set("head", el.querySelector(".stg-t"), titleHtml(ag));
    set("agents", body("agents"), agentsHtml(ag));
    set("changes", body("changes"), changesHtml(ch));
    el.querySelector('[data-fr-n="agents"]').textContent = ag.filter((a) => a.busy).length || "";
    el.querySelector('[data-fr-n="changes"]').textContent = ch.length || "";
    for (const b of el.querySelectorAll("[data-map-mode]")) { const on = map.mode === b.dataset.mapMode; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); }
    const fb = el.querySelector("[data-stg-full]");
    const fh = S.full ? UNFULL_IC : FULL_IC;
    if (fb._h !== fh) { fb.innerHTML = fh; fb._h = fh; }
    fb.setAttribute("aria-label", S.full ? "Back beside the conversation" : "Full size");
    fb.title = S.full ? "Back beside the conversation" : "Full size";
  }

  function open({ focus = true } = {}) {
    if (!S.open) {
      S.open = true;
      S.returnTo = document.activeElement;
      el.hidden = false;
      el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in");
      document.body.classList.add("stage-open");
    }
    S.railOff = true; // opened on purpose: shown whole, even beside Files
    fitRail();
    layout();
    paint();
    persist();
    if (focus) el.focus({ preventScroll: true });
    onChange && onChange();
  }

  function close({ restore = true } = {}) {
    if (!S.open) return;
    S.open = false;
    if (S.full) setFull(false);
    el.hidden = true;
    document.body.classList.remove("stage-open", "stage-rail");
    S.rail = false;
    map.hide();
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

  function toggle() { if (S.open && !S.rail) close(); else open(); }

  /** Every render: the frames follow the view; the rail follows Files. */
  function sync() {
    if (!S.open) return;
    fitRail();
    paint();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-stg-close]")) { close(); return; }
    if (t.closest("[data-stg-full]")) { setFull(!S.full); return; }
    const rl = t.closest("[data-rail]");
    if (rl) { S.railOff = true; fr[rl.dataset.rail].folded = false; fitRail(); layout(); paint(); persist(); return; }
    const fo = t.closest("[data-fr-fold]");
    if (fo) { const id = fo.dataset.frFold; fr[id].folded = !fr[id].folded; layout(); persist(); return; }
    const mm = t.closest("[data-map-mode]");
    if (mm) { if (fr.map.folded) { fr.map.folded = false; layout(); } map.setMode(mm.dataset.mapMode); paint(); return; }
    if (t.closest("[data-open-files]")) { filesView.open(); return; }
    const ch = t.closest("[data-change]");
    if (ch) { const rel = ch.dataset.change; viewer.open({ path: rel, name: rel.split("/").pop(), project: ch.dataset.changeProject, rel }, ch); return; }
    const g = t.closest("[data-go]");
    if (g) { go(g.dataset.go); }
  });
  // Esc: a search clears first; then full size steps back, then the panel closes
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (e.target.closest && e.target.closest("input") && e.target.value) return;
    e.preventDefault(); e.stopPropagation();
    if (S.full) setFull(false); else close();
  }, true);

  // the line between two frames: drag it (or ↑ ↓ on it) to give one of them room
  for (const g of el.querySelectorAll("[data-gut]")) {
    const [a, b] = g.dataset.gut.split("|");
    const resize = (dy) => {
      // the frame that isn't the Map takes or gives the room; the Map grows into what's left
      if (a === "agents") { const f = el.querySelector('[data-fr="agents"]'); fr.agents.h = Math.max(72, Math.min(400, (fr.agents.h || f.getBoundingClientRect().height) + dy)); fr.agents.folded = false; }
      else { fr.changes.h = Math.max(72, Math.min(600, fr.changes.h - dy)); fr.changes.folded = false; }
      layout();
    };
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      let y0 = e.clientY;
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
      resize(e.key === "ArrowDown" ? 16 : -16);
      persist();
    });
    g.addEventListener("dblclick", () => { if (a === "agents") fr.agents.h = null; else fr.changes.h = 200; layout(); persist(); });
  }

  // ── width: flush to the window's right edge, 360 px by default, 320–720 by dragging its left edge ─
  const W_KEY = "xo-stage-w", W_DEF = 360, W_MIN = 320, W_MAX = 720, RAIL = 40;
  // when the conversation beside it would drop under READ px, the panel floats over it (with a shadow)
  // instead of squeezing it: a cut-down thread title is worse than a covered margin
  const READ = 560;
  const RAIL_READ = 520; // beside Files, the reader keeps at least this much; under it the panel folds to its rail
  const sideW = () => { const side = document.querySelector(".side"); return side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0; };
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(W_MAX, innerWidth - 480, w)));
  let wSaved = W_DEF;
  try { wSaved = Number(localStorage.getItem(W_KEY)) || W_DEF; } catch { /* private mode */ }
  function apply() {
    const v = S.rail ? RAIL : clampW(wSaved);
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", !S.rail && innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  const setW = (w, save = false) => {
    wSaved = clampW(w);
    if (save) { try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  /** Beside Files, a wide panel folds to its rail so the reader keeps 560 px, unless you opened it. */
  function fitRail() {
    const tw = filesView.isOpen ? (parseFloat(getComputedStyle(document.querySelector("#fv") || document.body).getPropertyValue("--tw")) || 280) : 0;
    if (!filesView.isOpen) S.railOff = false;
    const want = S.open && filesView.isOpen && !S.railOff && innerWidth > 760 && innerWidth - sideW() - clampW(wSaved) - tw < RAIL_READ;
    if (want !== S.rail) {
      S.rail = want;
      document.body.classList.toggle("stage-rail", want);
      layout();
    }
    apply();
  }
  setW(wSaved);
  addEventListener("resize", () => fitRail());
  const grip = el.querySelector(".stg-grip");
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || S.full || S.rail) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (ev) => setW(right - ev.clientX);
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(wSaved, true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => setW(W_DEF, true));
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW(wSaved + (e.key === "ArrowLeft" ? 16 : -16), true);
  });

  if (saved.open) requestAnimationFrame(() => open({ focus: false }));

  return {
    get isOpen() { return S.open; },
    open: () => open(), close, toggle, sync,
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
