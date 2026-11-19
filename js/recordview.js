// A project's record on screen: Since you left, Made, and their doors on
// Home and in ⌘K. The pure part (what counts, which group, the words) is record.js.
//
// Since you left: a place ("home", "p:<project>") remembers, per browser, when you last looked
// (leaving it, hiding the tab or closing it marks it). Arriving after AWAY_MS or more, a card says
// what moved since, until "Got it" or a reload. A thread counts as its project, so opening a line
// and coming back keeps the card. Git words come from `GET /chat/worktrees`, read when a card shows.
//
// Made: what a project's threads made (every project's, on Home and the Workspace), as the Made tab
// of the panel (js/stage.js), newest first, by kind, with pins. A newer backend keeps it (`/chat/chats/{chat}/made`: files, links and branches, pins
// for every device, copies of shared files once a worktree goes); with an older one it is what each
// thread shared (its `outputs`), pinned per browser. A file opens in the panel's File tab.
//
// Every newer field is optional: a missing route (404) or field means the fallback, never an error.
// A made file with a title (xo-space 8c6bc03) is named by it, its file name on the card's second line (in
// place of the kind word) and in its tooltip; untitled, its name cuts in the middle. The thread that made
// it is `threadTitle` (record.js keeps the two apart).
// "Seen" is the backend's per chat when it has it (the later of it and this browser's), else this
// browser's; the thread's `summary` and `git` state make the card's words exact when they're there.
//
// app.js calls: placeOf, leave, sinceLine, homeSinceLines, homeMade, madeCount, jumpItems, and
// the panel's Made tab (made: mount, show, count); `panel` is set to the panel once it exists.

import { syncList, setText } from "./motion.js";
import { redraw } from "./redraw.js";
import { radioKeys, rovingTab } from "./keynav.js";
import * as R from "./record.js";
import { createSince } from "../modules/since/view.js";
import { createPreviews } from "../modules/artifacts/previews.js";
import { createCards, KIND_IC } from "../modules/artifacts/cards.js";
import { createMadeStore } from "../modules/artifacts/store.js";
import { createArtifactsPage } from "../modules/artifacts/page.js";
import { sinceSection } from "../modules/since/section.js";
import { madeSection } from "../modules/artifacts/section.js";
import { api } from "../core/platform/api.js";
import { esc } from "../core/platform/index.js";
import { ICON } from "./ui.js";
import { sharedFileRoute } from "./timeline.js";
import { midName, midNameHtml } from "./media.js";
import { skTile, bar as skBar, rememberedMade } from "./skeleton.js";

const RECENT = 6;           // Recently made on Home

/**
 * How a made thing is named (a card, ⌘K). label: its own title, else its name. html: the card's name, a
 * title cut at its end, a file name in its middle (its extension stays; a link's words and a branch at
 * their end). file: its name in `max` characters, which a titled card's second line shows. tip: the
 * card's tooltip. from: the thread that made it, by that thread's own title (never the file's).
 */
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

export function createRecord({ world, go, VW, PROJ, schedule, announce, mark = () => "", places }) {
  const SL = createSince({ world, api, schedule, announce });


  // ── Made ────────────────────────────────────────────────────────────────
  const M = { pid: null, kind: "all", q: "", host: null, built: false };
  let panel = null;
  const shown = () => !!(M.host && !M.host.hidden && panel && panel.isOpen);
  /** The project a view belongs to, or null (Home, the Workspace, Chats: every project). */
  const pidOf = (v) => (!v ? null : v.startsWith("p:") ? v.slice(2) : v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
  const MS = createMadeStore({ world, api, schedule, announce, changed: () => { if (shown()) madeRender(); } });
  const { madeOf, madePending, togglePin } = MS;
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
    // one scope line: where (the tab already says "Made"), then how many, newest first
    h.querySelector("#made-h").textContent = pid ? PROJ(pid) : "All projects";
    const kept = items.some((m) => m.server);
    h.querySelector("#made-sub").textContent = `${items.length} ${kept ? (items.length === 1 ? "thing" : "things") : (items.length === 1 ? "file" : "files")}, newest first`;
    // one Tab stop (the chosen kind), arrows between them (radioKeys), drawn in place so the focused one stays
    const f = R.KINDS.filter(([k]) => k === "all" || counts[k]).map(([k, w]) => `<button type="button" role="radio" data-made-kind="${k}" aria-checked="${M.kind === k}"${rovingTab(M.kind === k)}>${w}<span>${counts[k]}</span></button>`).join("");
    const fe = h.querySelector("#made-f");
    if (fe._h !== f) { redraw(fe, f); fe._h = f; }
    if (!fe._keys) { fe._keys = true; radioKeys(fe); }
    const be = h.querySelector("#made-body");
    // a new scope starts still (nothing "arrives" when you switch project or filter); within one, arrivals move
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
      const ul = be.querySelector(`[data-k="${CSS.escape(g.id)}"] .md-grid`);
      // a group that appears later (say, Pinned) brings its cards with it: they arrive, not land still
      if (seeded && !ul._seeded) ul._seeded = true;
      syncCards(ul, g.items, !pid);
    }
  }
  /** The panel's Made tab: where it draws, and which project it shows (the view's, or every one). */
  function mount(el) {
    M.host = el;
    el.addEventListener("click", (e) => {
      const k = e.target.closest("[data-made-kind]");
      if (k) { M.kind = k.dataset.madeKind; madeRender(); }
    });
    el.addEventListener("input", (e) => { if (e.target.id === "made-q") { M.q = e.target.value; madeRender(); } });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && e.target.id === "made-q" && e.target.value) { e.preventDefault(); e.stopPropagation(); e.target.value = ""; M.q = ""; madeRender(); } });
  }
  function showMade(view) {
    const pid = pidOf(view);
    if (pid !== M.pid) { M.pid = pid; M.kind = "all"; M.q = ""; const q = M.host && M.host.querySelector("#made-q"); if (q) q.value = ""; }
    madeRender();
  }
  function openFile(key, from) {
    const m = madeOf(null).find((x) => x.key === key);
    if (!m) return;
    if (m.kind === "link" && m.url) { window.open(m.url, "_blank", "noopener,noreferrer"); return; }
    if (m.kind === "branch") return; // its thread is the place to see a branch
    const route = m.exists === false ? { why: "This file isn't there any more: its worktree was removed and no copy was kept." }
      : m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : sharedFileRoute(world.thread(m.tid), m.path);
    VW.open({ path: m.path, name: m.name, type: m.type, bytes: m.bytes, ...route }, from);
  }

  /** A made card still coming (skeleton.js), as an element: where its card will be, at its size. */
  const skEl = (where) => ({ i }) => { tpl.innerHTML = skTile(where, i); return tpl.content.firstElementChild; };
  /** n stand-ins as list items (their keys can't be a made thing's). */
  const skItems = (n) => Array.from({ length: n }, (_, i) => ({ key: `~sk${i}`, sk: true, i }));

  /** Recently made, on Home: the newest few across every project, pinned ones first. Kept in place:
   *  a new thing arrives at the front and the others glide along; nothing else is redrawn. Until what was
   *  made has come, stand-ins as many as last time hold its place. */
  function homeMade(box) {
    const pending = madePending(null);
    const items = pending ? [] : madeOf(null);
    if (!box._built) {
      box.innerHTML = `<section class="md-recent" aria-labelledby="md-recent-h" hidden><h2 class="hm-lbl" id="md-recent-h">${ICON.spark}Recently made</h2><ul class="md-grid is-strip"></ul></section>`;
      box._built = true;
    }
    const sec = box.querySelector(".md-recent");
    const ul = sec.querySelector(".md-grid");
    if (pending) {
      // still asking what was made: as many stand-ins as there were things last time, where they'll be
      // (they take over from the shell's in place, still; what replaces them arrives)
      const n = Math.min(RECENT, rememberedMade() ?? 0);
      sec.hidden = !n;
      syncList(ul, skItems(n), { make: skEl(true), update: () => {} });
      box._sk = false;
      return;
    }
    // the shell's stand-ins were on screen: what lands now arrives (it doesn't just appear)
    if (box._sk) { box._sk = false; ul._seeded = true; }
    sec.hidden = !items.length;
    if (!items.length) return;
    const list = [...items.filter((m) => m.pinned), ...items.filter((m) => !m.pinned)].slice(0, RECENT);
    PV.loadThumbs(list); PV.loadTexts(list);
    syncCards(ul, list, true);
  }

  const AP = createArtifactsPage({ MS, PV, syncCards, PROJ, sk: { tile: skTile, bar: skBar } });

  /** ⌘K: made files by title or name, only once you've typed something. A titled one's file name leads its line. */
  function jumpItems(q) {
    if (!q) return [];
    const w = q.toLowerCase();
    return madeOf(null).filter((m) => `${m.title || ""} ${m.name} ${m.path}`.toLowerCase().includes(w)).slice(0, 8)
      .map((m) => ({ name: m.title || madeNaming(m, 48).file, sub: [m.title ? madeNaming(m, 32).file : "", `Made in ${PROJ(m.project)}`, m.threadTitle].filter(Boolean).join(" · "), icon: KIND_IC[m.kind] || ICON.doc, run: () => { if (m.kind !== "link" && m.tid) go("t:" + m.tid); openFile(m.key, null); } }));
  }

  // ── events ──────────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const t = e.target;
    const pin = t.closest("[data-made-pin]");
    if (pin) { togglePin(pin.dataset.madePin); return; }
    const f = t.closest("[data-made-file]");
    if (f) {
      const key = f.dataset.madeFile;
      const m = madeOf(null).find((x) => x.key === key);
      // a file opens in the panel's File tab, wherever you are; a branch is told in its thread
      if (m && m.kind === "branch") { if (m.tid) go("t:" + m.tid); return; }
      openFile(key, f);
      return;
    }
    const g = t.closest("[data-made-go]");
    if (g) { go(g.dataset.madeGo); return; }
  });

  places.contribute("home.section", sinceSection(SL), "xo.since");
  places.contribute("home.section", madeSection({ homeMade }), "xo.artifacts");

  return {
    placeOf: SL.placeOf, leave: SL.leave, sinceLine: SL.sinceLine, homeSinceLines: SL.homeSinceLines, homeMade, madeCount, jumpItems,
    /** The newest file a thread made (not a branch): what its finished card offers to open. */
    latestOf: (tid, project) => madeOf(project || null).find((x) => x.tid === tid && x.kind !== "branch" && x.kind !== "link" && x.exists !== false) || null,
    /** The Artifacts page (a sidebar place): render() draws it; count() is what the sidebar shows. */
    artifacts: { render: AP.render, count: () => (madePending(null) ? 0 : madeOf(null).length) },
    /** The panel's Made tab. */
    made: { mount, show: showMade, count: (v) => madeOf(pidOf(v)).length },
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
    /** app.js tells it where you are, for the tab's hide and close. */
    set view(fn) { SL.view = fn; },
  };
}
