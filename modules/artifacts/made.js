// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { syncList, seedList, listSeeded, setText } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";
import { radioKeys, rovingTab } from "../../core/ui/a11y/keynav.js";
import * as R from "./model.js";
import { createPreviews } from "./previews.js";
import { createMadeThumbnails } from "./made-thumbnails.js";
import { createCards, KIND_IC } from "./cards.js";
import { createMadeStore } from "./store.js";
import { createArtifactsPage } from "./page.js";
import { createRecentMade } from "./recent.js";
import { api } from "../../core/platform/api.js";
import { esc } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { sharedFileRoute } from "../../core/services/world/relay.js";
import { midName, midNameHtml } from "../../core/services/media/items.js";

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

/** @param {import("./page-types.d.ts").MadeDeps} deps */
export function createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade, scope = createScope() }) {
  /** @type {{pid: string | null, kind: string, q: string, host: HTMLElement | null, built: boolean}} */
  const M = { pid: null, kind: "all", q: "", host: null, built: false };
  let filterKey = "";
  /** @type {{isOpen?: boolean} | null} */
  let panel = null;
  const shown = () => !!(M.host && !M.host.hidden && panel && panel.isOpen);
  /** @param {string | null} v */
  const pidOf = (v) => (!v ? null : v.startsWith("p:") ? v.slice(2) : v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
  const MS = createMadeStore({ world, api, scope, schedule, announce, changed: () => { if (shown()) madeRender(); } });
  const { madeOf, madePending, togglePin } = MS;
  /** @param {string | null} pid */
  const madeCount = (pid) => madeOf(pid).length;
  const PV = createPreviews({ world, api, sharedFileRoute, scope, box: () => AP.box(),
    landed: () => { schedule(); if (shown()) madeRender(); } });

  const { syncCards } = createCards({ PV, PROJ, naming: madeNaming });
  const homeMade = createRecentMade({ MS, PV, syncCards, skTile, rememberedMade });
  const showThumbs = createMadeThumbnails(scope, PV);

  function madeRender() {
    if (!M.host) return;
    const pid = M.pid && world.project(M.pid) ? M.pid : null;
    const items = madeOf(pid);
    const counts = Object.fromEntries(R.KINDS.map(([k]) => [k, k === "all" ? items.length : items.filter((m) => m.kind === k).length]));
    const list = R.filterMade(items, { kind: M.kind, q: M.q });
    const groups = R.madeGroups(list);
    const h = M.host;
    if (!M.built) {
      h.innerHTML = `<div class="md-pane"><header class="md-h"><h2 id="made-h"></h2><p id="made-sub"></p></header>` +
        `<div class="all-tools md-tools"><div class="all-q"><span>${ICON.search}</span><input id="made-q" placeholder="Find something made" autocomplete="off" aria-label="Find something made"></div>` +
        `<div class="all-f" id="made-f" role="radiogroup" aria-label="Show"></div></div><div class="md-body" id="made-body"></div></div>`;
      M.built = true;
      radioKeys(/** @type {HTMLElement} */ (h.querySelector("#made-f")));
    }
    (/** @type {HTMLElement} */ (h.querySelector("#made-h"))).textContent = pid ? PROJ(pid) : "All projects";
    const kept = items.some((m) => m.server);
    (/** @type {HTMLElement} */ (h.querySelector("#made-sub"))).textContent = `${items.length} ${kept ? (items.length === 1 ? "thing" : "things") : (items.length === 1 ? "file" : "files")}, newest first`;
    const f = R.KINDS.filter(([k]) => k === "all" || counts[k]).map(([k, w]) => `<button type="button" role="radio" data-made-kind="${k}" aria-checked="${M.kind === k}"${rovingTab(M.kind === k)}>${w}<span>${counts[k]}</span></button>`).join("");
    redraw(h.querySelector("#made-f"), f);
    const be = /** @type {HTMLElement} */ (h.querySelector("#made-body"));
    const nextKey = JSON.stringify([pid, M.kind, M.q]);
    if (filterKey !== nextKey) { redraw(be, ""); seedList(be, false); filterKey = nextKey; }
    if (!groups.length) {
      const none = `<p class="md-none">${items.length ? `Nothing made matches “${esc(M.q)}”.` : `<b>Nothing made yet.</b> Files ${pid ? "its" : "your"} threads share show up here, newest first.`}</p>`;
      redraw(be, none); seedList(be, false);
      showThumbs(be, []);
      return;
    }
    const seeded = listSeeded(be);
    syncList(be, groups.map((g) => ({ key: g.id, g })), {
      make: ({ g }) => { const sec = document.createElement("section"); sec.className = "md-g"; sec.innerHTML = `<h3 class="md-gh">${esc(g.label)}</h3><ul class="md-grid"></ul>`; return sec; },
      update: (sec, { g }) => setText(sec.querySelector(".md-gh"), g.label),
    });
    for (const g of groups) {
      const ul = /** @type {HTMLElement} */ (be.querySelector(`[data-k="${CSS.escape(g.id)}"] .md-grid`));
      if (seeded) seedList(ul, true);
      syncCards(ul, g.items, !pid);
    }
    showThumbs(be, list);
  }
  /** @param {HTMLElement} el */
  function mount(el) {
    M.host = el;
    scope.listen(el, "click", (e) => {
      const k = (/** @type {Element} */ (e.target)).closest("[data-made-kind]");
      if (k) { M.kind = (/** @type {string} */ ((/** @type {HTMLElement} */ (k)).dataset.madeKind)); madeRender(); }
    });
    scope.listen(el, "input", (e) => { if ((/** @type {HTMLInputElement} */ (e.target)).id === "made-q") { M.q = (/** @type {HTMLInputElement} */ (e.target)).value; madeRender(); } });
    scope.listen(el, "keydown", (event) => { const e = /** @type {KeyboardEvent} */ (event); if (e.key === "Escape" && (/** @type {HTMLInputElement} */ (e.target)).id === "made-q" && (/** @type {HTMLInputElement} */ (e.target)).value) { e.preventDefault(); e.stopPropagation(); (/** @type {HTMLInputElement} */ (e.target)).value = ""; M.q = ""; madeRender(); } });
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

  const AP = createArtifactsPage({ MS, PV, syncCards, PROJ, sk: { tile: skTile, bar: skBar } });

  /** @param {string} q */
  function jumpItems(q) {
    if (!q) return [];
    const w = q.toLowerCase();
    return madeOf(null).filter((m) => `${m.title || ""} ${m.name} ${m.path}`.toLowerCase().includes(w)).slice(0, 8)
      .map((m) => ({
        name: m.title || madeNaming(m, 48).file,
        sub: [m.title ? madeNaming(m, 32).file : "", m.project ? `Made in ${PROJ(m.project)}` : "", m.threadTitle]
          .filter(Boolean).join(" · "),
        icon: KIND_IC[m.kind] || ICON.doc,
        run() {
          if (m.kind !== "link" && m.tid) go("t:" + m.tid);
          openFile(m.key, null);
        },
      }));
  }

  scope.listen(document, "click", (e) => {
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
    homeMade, madeCount, jumpItems, dispose: scope.dispose,
    /** @param {string} tid @param {string | null} project */
    latestOf: (tid, project) => madeOf(project || null).find((x) => x.tid === tid && x.kind !== "branch" && x.kind !== "link" && x.exists !== false) || null,
    artifacts: { render: AP.render, count: () => (madePending(null) ? 0 : madeOf(null).length) },
    made: { mount, show: showMade, count: (/** @type {string | null} */ v) => madeOf(pidOf(v)).length },
    /** @param {{isOpen?: boolean} | null} p */
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
  };
}
