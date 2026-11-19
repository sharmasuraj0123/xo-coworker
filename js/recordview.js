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

import { syncList, setHtml, setText } from "./motion.js";
import { redraw } from "./redraw.js";
import { radioKeys, rovingTab } from "./keynav.js";
import * as R from "./record.js";
import { createSince } from "../modules/since/view.js";
import { createPreviews } from "../modules/artifacts/previews.js";
import { createCards, KIND_IC } from "../modules/artifacts/cards.js";
import { createMadeStore } from "../modules/artifacts/store.js";
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
  const { madeOf, madePending, olderPages, projectsMade, togglePin } = MS;
  const madeCount = (pid) => madeOf(pid).length;
  const PV = createPreviews({ world, api, sharedFileRoute, box: () => A.box, landed: () => { schedule(); if (shown()) madeRender(); } });


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

  // ── the Artifacts page: everything threads made, across projects, a place of its own ────────────
  // It can hold thousands, so only what's near the screen is drawn. The gallery is laid out as lines (a
  // group's heading, a row of cards; record.js galleryLines) at places worked out from a card's measured
  // size, the list keeps its whole height, and as you scroll the lines within a screen of view are drawn
  // and the rest let go: the page holds a few dozen cards whether there are fifty or five thousand. Every
  // card has the same height (a card without a thread keeps an empty "from" line), so nothing moves as lines
  // come and go. Search, the kinds and the project filter the whole set (record.js artsView). The place
  // outlives a visit (app.js keeps the scroll), and a picture is read only when its card nears the screen,
  // fading in once decoded. While what was made is still being read, stand-in cards in the cards' own size
  // hold the place, and land as it arrives.
  const A = { box: null, kind: "all", pid: "", q: "", lines: null, els: new Map(), byKey: new Map(), M: null, placeT: 0, arrive: false, tio: null };
  const tracks = (ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").filter(Boolean).length;
  /** The gallery's sizes, read from a hidden heading and stand-in card (so they follow the CSS, the width and the phone). */
  function artsMetrics(be) {
    let p = be.querySelector(":scope > .ar-probe");
    if (!p) {
      p = document.createElement("div");
      p.className = "ar-probe";
      p.setAttribute("aria-hidden", "true");
      p.innerHTML = `<h2 class="ar-gh">Today</h2><ul class="md-grid ar-grid">${skTile("page")}</ul>`;
      be.prepend(p);
    }
    const ul = p.querySelector("ul");
    return { cols: Math.max(1, tracks(ul)), gap: parseFloat(getComputedStyle(ul).rowGap) || 0, headH: p.firstElementChild.offsetHeight, cardH: ul.firstElementChild.offsetHeight };
  }
  /** Draw the lines within a screen of view, let the others go. */
  function artsPlace() {
    A.placeT = 0;
    const box = A.box, be = box && box.querySelector("#arts-body");
    if (!be || box.hidden || !A.lines) return;
    const top = box.scrollTop - be.offsetTop, H = box.clientHeight;
    const want = R.linesIn(A.lines, top - H, top + 2 * H);
    const keep = new Set(want.map((l) => l.key));
    // the card you're on stays, wherever the scroll goes; but a card that moved (pinned or unpinned to another
    // group) is drawn where it went, and the line it left goes with the rest (Astra H13: a stale copy stayed
    // under the new one), its control taking focus there
    const ae = document.activeElement && be.contains(document.activeElement) ? document.activeElement : null;
    const fCard = ae && ae.closest(".md-it"), fKey = fCard && fCard.dataset.k, fCtl = ae && (ae.matches(".md-pin") ? ".md-pin" : ae.matches(".md-from") ? ".md-from" : ".md-open");
    // where that card is now, in the whole layout (not only the lines near the screen: pinned, it can move far
    // above them; Astra on 453de55); moved, its new line is drawn too, wherever it is, and focus lands there
    const at = fKey ? A.lines.find((l) => l.kind === "row" && l.g.items.slice(l.start, l.start + l.n).some((it) => it.key === fKey)) : null;
    const moved = !!at && !(A.els.get(at.key) && A.els.get(at.key).contains(fCard));
    if (moved && !keep.has(at.key)) { want.push(at); want.sort((x, y) => x.y - y.y); keep.add(at.key); }
    const focus = ae && !moved ? ae.closest(".ar-line") : null;
    for (const [k, el] of A.els) {
      if (keep.has(k) || el === focus) continue;
      if (A.tio) for (const c of el.querySelectorAll(".md-it")) A.tio.unobserve(c);
      el.remove();
      A.els.delete(k);
    }
    let prev = be.querySelector(":scope > .ar-probe");
    for (const l of want) {
      let el = A.els.get(l.key);
      if (!el) {
        if (l.kind === "head") { el = document.createElement("h2"); el.className = "ar-gh ar-line"; }
        else if (l.kind === "row") { el = document.createElement("ul"); el.className = "md-grid ar-grid ar-line"; el._seeded = A.arrive; }
        else { el = document.createElement("div"); el.className = "ar-line"; el.setAttribute("aria-hidden", "true"); }
        A.els.set(l.key, el);
      }
      if (l.kind === "tail" && el._n !== l.rows * A.M.cols) { el._n = l.rows * A.M.cols; el.innerHTML = `<ul class="md-grid ar-grid">${Array.from({ length: el._n }, (_, i) => skTile("page", i)).join("")}</ul>`; }
      const y = `${l.y}px`;
      if (el.style.top !== y) el.style.top = y;
      if (l.kind === "head") setText(el, l.g.label);
      else if (l.kind === "row") {
        const items = l.g.items.slice(l.start, l.start + l.n);
        syncCards(el, items, "page");
        // pictures: read when their card comes within a screen of view
        if (A.tio) for (const c of el.children) { const m = A.byKey.get(c.dataset.k); if (!c._tw && m && ((m.kind === "image" && !PV.thumbs.has(m.key)) || PV.wantsText(m))) { c._tw = true; A.tio.observe(c); } }
      }
      // in order, so Tab goes card by card down the page
      const at = prev ? prev.nextElementSibling : be.firstElementChild;
      if (at !== el) be.insertBefore(el, at);
      prev = el;
    }
    // landed where it went, brought into view (the page doesn't jump to it otherwise: it stays anchored)
    if (moved) be.querySelector(`.md-it[data-k="${CSS.escape(fKey)}"] ${fCtl}`)?.focus();
    A.arrive = false;
  }
  function artsWatch(box) {
    const be = box.querySelector("#arts-body");
    box.addEventListener("scroll", () => { if (!A.placeT) A.placeT = requestAnimationFrame(artsPlace); }, { passive: true });
    // a new width (the window, the panel opening beside it) can mean a new number of columns
    if (typeof ResizeObserver === "function") { let w = 0; new ResizeObserver(() => { if (!box.hidden && be.clientWidth && be.clientWidth !== w) { w = be.clientWidth; if (A.lines) artsRender(); } }).observe(be); }
    if (typeof IntersectionObserver === "function") {
      A.tio = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          A.tio.unobserve(e.target);
          const m = A.byKey.get(e.target.dataset.k);
          if (m) { PV.nearY.set(m.key, { y: e.boundingClientRect.top - e.rootBounds.top + A.box.scrollTop }); PV.loadThumbs([m]); PV.loadTexts([m]); }
        }
      }, { root: box, rootMargin: "50% 0px" });
    }
  }
  function artsRender() {
    const box = A.box || (A.box = document.getElementById("arts"));
    if (!box || box.hidden) return; // nothing is measured or drawn unseen
    if (!box._built) {
      box.innerHTML = `<header class="ar-head"><span class="tw-ic" aria-hidden="true">${ICON.stack}</span><span class="tw-t"><h1 id="arts-h">Artifacts</h1><p class="pj-s ar-sub" id="arts-sub"></p></span></header><div class="ar-wrap">` +
        `<div class="ar-tools"><label class="ar-q">${ICON.search}<span class="sr-only">Find an artifact</span><input id="arts-q" placeholder="Find an artifact" autocomplete="off" spellcheck="false"></label>` +
        `<label class="ar-pj"><span class="sr-only">Project</span><xo-select id="arts-pj"></xo-select></label></div>` +
        `<div class="ar-kinds" id="arts-f" role="radiogroup" aria-label="Show"></div><div class="ar-body" id="arts-body"></div></div>`;
      box._built = true;
      box.addEventListener("input", (e) => { if (e.target.id === "arts-q") { A.q = e.target.value; artsRender(); } });
      box.addEventListener("change", (e) => { if (e.target.id === "arts-pj") { A.pid = e.target.value; artsRender(); } });
      box.addEventListener("click", (e) => { const k = e.target.closest("[data-arts-kind]"); if (k) { A.kind = k.dataset.artsKind; artsRender(); } });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape" && e.target.id === "arts-q" && e.target.value) { e.preventDefault(); e.stopPropagation(); e.target.value = ""; A.q = ""; artsRender(); } });
      artsWatch(box);
    }
    const pending = madePending(null);
    const all = pending ? [] : madeOf(null);
    if (!pending) olderPages(); // what's older than each chat's newest page, read in the background
    const v = R.artsView(all, { pid: A.pid, kind: A.kind, q: A.q });
    setHtml(box.querySelector("#arts-sub"), pending ? skBar("18em") : all.length ? esc(`${all.length} ${all.length === 1 ? "thing" : "things"} your threads made, newest first`) : "What your threads make shows up here");
    // projects that made something, in the sidebar's order
    const made = new Set(all.map((m) => m.project));
    const pids = projectsMade().filter((p) => made.has(p.id));
    const opts = `<option value="">All projects</option>` + pids.map((p) => `<option value="${esc(p.id)}"${A.pid === p.id ? " selected" : ""}>${esc(p.name || p.id)}</option>`).join("");
    setHtml(box.querySelector("#arts-pj"), opts);
    // the kinds: one Tab stop (the chosen one), arrows choose (radioKeys), drawn in place so the focused one stays
    // (Astra C065/H5: arrows did nothing, and Space dropped focus as the strip was redrawn)
    // the kind you chose stays in the strip even where it has nothing (another project): one choice checked and
    // one Tab stop, always (Astra C065 on 453de55: Images, then a project with only Docs, left neither)
    const kf = box.querySelector("#arts-f"), kh = R.KINDS.filter(([k]) => k === "all" || v.counts[k] || k === A.kind).map(([k, w]) => `<button type="button" role="radio" data-arts-kind="${k}" aria-checked="${A.kind === k}"${rovingTab(A.kind === k)}>${w}<span>${pending ? "" : v.counts[k] || 0}</span></button>`).join("");
    if (kf._h !== kh) { redraw(kf, kh); kf._h = kh; }
    if (!kf._keys) { kf._keys = true; radioKeys(kf); }
    // Images is the one filter shown as pictures on a phone; everything else is a list of rows (css/artifacts.css)
    box.classList.toggle("is-pics", A.kind === "image");
    const be = box.querySelector("#arts-body");
    // a new filter is a new list: drawn afresh, still
    const scope = `${A.pid}|${A.kind}|${A.q}|${pending ? "…" : ""}`;
    if (be._scope !== scope) {
      A.arrive = /…$/.test(be._scope || ""); // what was being read has come: its first cards arrive
      be._scope = scope; be._h = null; be.innerHTML = ""; be.style.height = "";
      A.els = new Map(); A.lines = null;
    }
    if (pending || !v.groups.length) {
      // still reading: a screen of stand-ins in the gallery's own shape; or nothing to show
      const html = pending ? `<section class="ar-g" aria-hidden="true"><h2 class="ar-gh">${skBar("64px")}</h2><ul class="md-grid ar-grid">${Array.from({ length: 12 }, (_, i) => skTile("page", i)).join("")}</ul></section>`
        : `<p class="ar-none">${!all.length ? "<b>Nothing made yet.</b> Files, pages and pictures your threads share land here, newest first."
          : A.q ? `Nothing matches “${esc(A.q)}”.`
          : `No ${esc(((R.KINDS.find(([k]) => k === A.kind) || [])[1] || "things").toLowerCase())} ${A.pid ? "in this project" : "yet"}.`}</p>`;
      if (be._h !== html) { be.innerHTML = html; be._h = html; be.style.height = ""; A.els = new Map(); A.lines = null; }
      return;
    }
    if (be._h) { be.innerHTML = ""; be._h = null; A.els = new Map(); }
    const M = (A.M = artsMetrics(be));
    A.byKey = new Map();
    for (const g of v.groups) for (const m of g.items) A.byKey.set(m.key, m);
    // older pages still on their way: two rows of stand-ins under the list
    const reading = MS.olderLeft();
    // what you're looking at stays where it is when things land above it (a new thing at the top, a pinned one
    // from an older page): the first card in view is the anchor, and the scroll follows it
    const view = box.scrollTop - be.offsetTop;
    let anchor = null;
    if (A.lines && view > 0) {
      const l = R.linesIn(A.lines, view, view).find((x) => x.kind === "row");
      if (l) anchor = { key: l.g.items[l.start]?.key, off: l.y - view };
    }
    const { lines, height } = R.galleryLines(v.groups, { cols: M.cols, cardH: M.cardH, headH: M.headH, gap: M.gap, tail: reading ? 2 : 0 });
    A.lines = lines;
    const h = `${height}px`;
    if (be.style.height !== h) be.style.height = h;
    if (anchor && anchor.key) {
      const l = lines.find((x) => x.kind === "row" && x.g.items.slice(x.start, x.start + x.n).some((m) => m.key === anchor.key));
      const to = l ? Math.round(be.offsetTop + l.y - anchor.off) : null;
      if (to != null && Math.abs(to - box.scrollTop) >= 1) box.scrollTop = to;
    }
    artsPlace();
  }

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
    artifacts: { render: artsRender, count: () => (madePending(null) ? 0 : madeOf(null).length) },
    /** The panel's Made tab. */
    made: { mount, show: showMade, count: (v) => madeOf(pidOf(v)).length },
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
    /** app.js tells it where you are, for the tab's hide and close. */
    set view(fn) { SL.view = fn; },
  };
}
