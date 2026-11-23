// @ts-check
import { syncList, setText } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";
import { radioKeys, rovingTab } from "../../core/ui/a11y/keynav.js";
import * as R from "./model.js";
import { createPreviews } from "./previews.js";
import { createCards, KIND_IC } from "./cards.js";
import { createMadeStore } from "./store.js";
import { createArtifactsPage } from "./page.js";
import { api } from "../../core/platform/api.js";
import { esc } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { sharedFileRoute } from "../../core/services/world/relay.js";
import { midName, midNameHtml } from "../../core/services/media/items.js";

const RECENT = 6;           // Recently made on Home

/** @typedef {import("./types.d.ts").Made} Made */

/** @param {Pick<Made, "kind" | "name" | "title" | "path" | "threadTitle">} m */
export function madeNaming(m, max = 28) {
  const isFile = m.kind !== "link" && m.kind !== "branch";
  const file = isFile ? midName(m.name, max) : m.name;
  return {
    label: m.title || m.name,
    html: m.title ? esc(m.title) : isFile ? midNameHtml(m.name) : esc(m.name),
    file,
    tip: m.title ? `${m.title} · ${m.path}` : m.path,
    from: m.threadTitle || "Its thread",
  };
}

/** @typedef {{_h?: string | null, _keys?: boolean, _scope?: string, _seeded?: boolean, _built?: boolean, _sk?: boolean}} RenderState */

/** @typedef {{world: {thread: (id: string | null) => {project?: string, worktree?: string, cwd?: string} | null | undefined, project: (id: string) => unknown}, go: (view: string) => void, VW: {open: (file: {path: string, name: string, type: string, bytes: number | null, project?: string, rel?: string, why?: string}, from: Element | null) => void}, PROJ: (id: string) => string, schedule: () => void, announce: (words: string) => void, skTile: (where: boolean | "page", i?: number) => string, skBar: (w?: string, cls?: string) => string, rememberedMade: () => number | null}} MadeDeps */

/** @param {MadeDeps} deps */
export function createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade }) {
  /** @type {{pid: string | null, kind: string, q: string, host: HTMLElement | null, built: boolean}} */
  const M = { pid: null, kind: "all", q: "", host: null, built: false };
  /** @type {{isOpen?: boolean} | null} */
  let panel = null;
  const shown = () => !!(M.host && !M.host.hidden && panel && panel.isOpen);
  /** @param {string | null} v */
  const pidOf = (v) => (!v ? null : v.startsWith("p:") ? v.slice(2) : v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
  const MS = createMadeStore({ world, api, schedule, announce, changed: () => { if (shown()) madeRender(); } });
  const { madeOf, madePending, togglePin } = MS;
  /** @param {string | null} pid */
  const madeCount = (pid) => madeOf(pid).length;
  const PV = createPreviews({ world, api, sharedFileRoute, box: () => AP.box(), landed: () => { schedule(); if (shown()) madeRender(); } });

  const { syncCards } = createCards({ PV, PROJ, naming: madeNaming });
  const tpl = document.createElement("template");

  function madeRender() {
    if (!M.host) return;
    const pid = M.pid && world.project(M.pid) ? M.pid : null;
    const items = madeOf(pid);
    const counts = Object.fromEntries(R.KINDS.map(([k]) => [k, k === "all" ? items.length : items.filter((m) => m.kind === k).length]));
    const list = R.filterMade(items, { kind: M.kind, q: M.q });
    const groups = R.madeGroups(list);
    PV.loadThumbs(list.slice(0, 48)); // the first screens' worth; the queue takes them nearest first
    const h = M.host;
    if (!M.built) {
      h.innerHTML = `<div class="md-pane"><header class="md-h"><h2 id="made-h"></h2><p id="made-sub"></p></header>` +
        `<div class="all-tools md-tools"><div class="all-q"><span>${ICON.search}</span><input id="made-q" placeholder="Find something made" autocomplete="off" aria-label="Find something made"></div>` +
        `<div class="all-f" id="made-f" role="radiogroup" aria-label="Show"></div></div><div class="md-body" id="made-body"></div></div>`;
      M.built = true;
    }
    (/** @type {HTMLElement} */ (h.querySelector("#made-h"))).textContent = pid ? PROJ(pid) : "All projects";
    const kept = items.some((m) => m.server);
    (/** @type {HTMLElement} */ (h.querySelector("#made-sub"))).textContent = `${items.length} ${kept ? (items.length === 1 ? "thing" : "things") : (items.length === 1 ? "file" : "files")}, newest first`;
    const f = R.KINDS.filter(([k]) => k === "all" || counts[k]).map(([k, w]) => `<button type="button" role="radio" data-made-kind="${k}" aria-checked="${M.kind === k}"${rovingTab(M.kind === k)}>${w}<span>${counts[k]}</span></button>`).join("");
    const fe = (/** @type {HTMLElement & RenderState} */ (h.querySelector("#made-f")));
    if (fe._h !== f) { redraw(fe, f); fe._h = f; }
    if (!fe._keys) { fe._keys = true; radioKeys(fe); }
    const be = (/** @type {HTMLElement & RenderState} */ (h.querySelector("#made-body")));
    const scope = `${pid}|${M.kind}|${M.q}`;
    if (be._scope !== scope) { be.innerHTML = ""; be._seeded = false; be._h = null; be._scope = scope; }
    if (!groups.length) {
      const none = `<p class="md-none">${items.length ? `Nothing made matches “${esc(M.q)}”.` : `<b>Nothing made yet.</b> Files ${pid ? "its" : "your"} threads share show up here, newest first.`}</p>`;
      if (be._h !== none) { be.innerHTML = none; be._h = none; be._seeded = false; }
      return;
    }
    be._h = null;
    const seeded = !!be._seeded;
    syncList(be, groups.map((g) => ({ key: g.id, g })), {
      make: ({ g }) => { const sec = document.createElement("section"); sec.className = "md-g"; sec.innerHTML = `<h3 class="md-gh">${esc(g.label)}</h3><ul class="md-grid"></ul>`; return sec; },
      update: (sec, { g }) => setText(sec.querySelector(".md-gh"), g.label),
    });
    for (const g of groups) {
      const ul = (/** @type {HTMLElement & RenderState} */ (be.querySelector(`[data-k="${CSS.escape(g.id)}"] .md-grid`)));
      if (seeded && !ul._seeded) ul._seeded = true;
      syncCards(ul, g.items, !pid);
    }
  }
  /** @param {HTMLElement} el */
  function mount(el) {
    M.host = el;
    el.addEventListener("click", (e) => {
      const k = (/** @type {Element} */ (e.target)).closest("[data-made-kind]");
      if (k) { M.kind = (/** @type {string} */ ((/** @type {HTMLElement} */ (k)).dataset.madeKind)); madeRender(); }
    });
    el.addEventListener("input", (e) => { if ((/** @type {HTMLInputElement} */ (e.target)).id === "made-q") { M.q = (/** @type {HTMLInputElement} */ (e.target)).value; madeRender(); } });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && (/** @type {HTMLInputElement} */ (e.target)).id === "made-q" && (/** @type {HTMLInputElement} */ (e.target)).value) { e.preventDefault(); e.stopPropagation(); (/** @type {HTMLInputElement} */ (e.target)).value = ""; M.q = ""; madeRender(); } });
  }
  /** @param {string | null} view */
  function showMade(view) {
    const pid = pidOf(view);
    if (pid !== M.pid) { M.pid = pid; M.kind = "all"; M.q = ""; const q = M.host && (/** @type {HTMLInputElement | null} */ (M.host.querySelector("#made-q"))); if (q) q.value = ""; }
    madeRender();
  }
  /** @param {string} key @param {Element | null} from */
  function openFile(key, from) {
    const m = madeOf(null).find((x) => x.key === key);
    if (!m) return;
    if (m.kind === "link" && m.url) { window.open(m.url, "_blank", "noopener,noreferrer"); return; }
    if (m.kind === "branch") return; // its thread is the place to see a branch
    const route = m.exists === false ? { why: "This file isn't there any more: its worktree was removed and no copy was kept." }
      : m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : sharedFileRoute(world.thread(m.tid), m.path);
    VW.open({ path: m.path, name: m.name, type: m.type, bytes: m.bytes, ...route }, from);
  }

  /** @param {boolean} where */
  const skEl = (where) => /** @param {{i: number}} item */ ({ i }) => { tpl.innerHTML = skTile(where, i); return (/** @type {HTMLElement} */ (tpl.content.firstElementChild)); };
  /** @param {number} n */
  const skItems = (n) => Array.from({ length: n }, (_, i) => ({ key: `~sk${i}`, sk: true, i }));

  /** @param {HTMLElement & RenderState} box */
  function homeMade(box) {
    const pending = madePending(null);
    const items = pending ? [] : madeOf(null);
    if (!box._built) {
      box.innerHTML = `<section class="md-recent" aria-labelledby="md-recent-h" hidden><h2 class="hm-lbl" id="md-recent-h">${ICON.spark}Recently made</h2><ul class="md-grid is-strip"></ul></section>`;
      box._built = true;
    }
    const sec = (/** @type {HTMLElement} */ (box.querySelector(".md-recent")));
    const ul = (/** @type {HTMLElement & RenderState} */ (sec.querySelector(".md-grid")));
    if (pending) {
      const n = Math.min(RECENT, rememberedMade() ?? 0);
      sec.hidden = !n;
      syncList(ul, skItems(n), { make: skEl(true), update: () => {} });
      box._sk = false;
      return;
    }
    if (box._sk) { box._sk = false; ul._seeded = true; }
    sec.hidden = !items.length;
    if (!items.length) return;
    const list = [...items.filter((m) => m.pinned), ...items.filter((m) => !m.pinned)].slice(0, RECENT);
    PV.loadThumbs(list); PV.loadTexts(list);
    syncCards(ul, list, true);
  }

  const AP = createArtifactsPage({ MS, PV, syncCards, PROJ, sk: { tile: skTile, bar: skBar } });

  /** @param {string} q */
  function jumpItems(q) {
    if (!q) return [];
    const w = q.toLowerCase();
    return madeOf(null).filter((m) => `${m.title || ""} ${m.name} ${m.path}`.toLowerCase().includes(w)).slice(0, 8)
      .map((m) => ({ name: m.title || madeNaming(m, 48).file, sub: [m.title ? madeNaming(m, 32).file : "", `Made in ${PROJ(m.project)}`, m.threadTitle].filter(Boolean).join(" · "), icon: KIND_IC[m.kind] || ICON.doc, run: () => { if (m.kind !== "link" && m.tid) go("t:" + m.tid); openFile(m.key, null); } }));
  }

  document.addEventListener("click", (e) => {
    const t = (/** @type {Element} */ (e.target));
    const pin = t.closest("[data-made-pin]");
    if (pin) { togglePin((/** @type {string} */ ((/** @type {HTMLElement} */ (pin)).dataset.madePin))); return; }
    const f = t.closest("[data-made-file]");
    if (f) {
      const key = (/** @type {string} */ ((/** @type {HTMLElement} */ (f)).dataset.madeFile));
      const m = madeOf(null).find((x) => x.key === key);
      if (m && m.kind === "branch") { if (m.tid) go("t:" + m.tid); return; }
      openFile(key, f);
      return;
    }
    const g = t.closest("[data-made-go]");
    if (g) { go((/** @type {string} */ ((/** @type {HTMLElement} */ (g)).dataset.madeGo))); return; }
  });
  return {
    homeMade, madeCount, jumpItems,
    /** @param {string} tid @param {string | null} project */
    latestOf: (tid, project) => madeOf(project || null).find((x) => x.tid === tid && x.kind !== "branch" && x.kind !== "link" && x.exists !== false) || null,
    artifacts: { render: AP.render, count: () => (madePending(null) ? 0 : madeOf(null).length) },
    made: { mount, show: showMade, count: (/** @type {string | null} */ v) => madeOf(pidOf(v)).length },
    /** @param {{isOpen?: boolean} | null} p */
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
  };
}
