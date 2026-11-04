// A project's record on screen (design-research/12): Since you left, Made, and their doors on
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
// "Seen" is the backend's per chat when it has it (the later of it and this browser's), else this
// browser's; the thread's `summary` and `git` state make the card's words exact when they're there.
//
// app.js calls: placeOf, leave, projectSince, homeSinceHtml, homeMade, madeCount, jumpItems, and
// the panel's Made tab (made: mount, show, count); `panel` is set to the panel once it exists.

import { syncList, fadeImage, setHtml, setText } from "./motion.js";
import * as R from "./record.js";
import { api } from "./api.js";
import { esc } from "./util.js";
import { ICON, $, short } from "./ui.js";
import { sharedFileRoute } from "./timeline.js";
import { fileIcon } from "./fileicons.js";

const PINS = "xo-made-pins";
const TREES_MS = 60000;     // worktrees read at most this often per chat
const LINES = 6;            // a card's lines before "+N more"
const RECENT = 6;           // Recently made on Home

const KIND_IC = { image: ICON.image, page: ICON.globe, doc: ICON.doc, data: ICON.list, code: ICON.edit, link: ICON.arrow, branch: ICON.branch };

export function createRecord({ world, go, VW, PROJ, schedule, announce }) {
  const seen = R.createSeen(localStorage);
  const since = new Map();        // place → when you'd last looked, if you were away long enough; null: nothing to say
  const done = new Set();         // places whose card you dismissed in this page
  const more = new Set();         // places whose card shows every line
  const trees = new Map();        // chat id ("" for all) → {at, loading, map: thread ts → worktree}
  let pins = new Set();
  try { pins = new Set(JSON.parse(localStorage.getItem(PINS) || "[]")); } catch { /* private mode */ }
  const savePins = () => { try { localStorage.setItem(PINS, JSON.stringify([...pins])); } catch { /* private mode */ } };

  const threadsIn = (pid) => world.state.threads.filter((t) => t.project === pid);
  const allThreads = () => world.state.threads.filter((t) => t.project && t.project !== "workspace");

  /** The place a view belongs to: a thread is part of its project; chats and the Workspace keep no record. */
  function placeOf(v) {
    if (v === "home") return "home";
    if (v.startsWith("p:")) return v;
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); return t && t.project && t.project !== "workspace" ? "p:" + t.project : null; }
    return null;
  }
  // the backend's seen marks, per project chat ({seen_at}); null until read, {} when it has none
  let remoteSeen = null;
  api.chats().then((d) => {
    const m = {};
    for (const c of d.chats || []) if (c && "seen" in c) m[c.id] = c.seen ? Date.parse(c.seen.seen_at) || null : null;
    remoteSeen = m;
  }).catch(() => { remoteSeen = {}; }).finally(() => schedule());
  const chatOfPlace = (place) => (place && place.startsWith("p:") ? world.project(place.slice(2))?.chatId || null : null);
  function markPlace(place) {
    seen.mark(place);
    const chat = chatOfPlace(place);
    if (chat && remoteSeen && chat in remoteSeen) { remoteSeen[chat] = Date.now(); api.markSeen(chat).catch(() => { /* this browser's mark still holds */ }); }
  }
  /** First arrival at a place in this page: were you away long enough to be told what happened? */
  // ?away=3d (or 12h) pretends you were away that long, for every place in this page: a way to see the
  // cards without waiting. Nothing is stored by it.
  const AWAY = (() => { const m = /^(\d+)([dh])$/.exec(new URLSearchParams(location.search).get("away") || ""); return m ? +m[1] * (m[2] === "d" ? 86400000 : 3600000) : 0; })();
  function arrive(place) {
    if (since.has(place)) return since.get(place);
    if (AWAY) { since.set(place, Date.now() - AWAY); return since.get(place); }
    const chat = chatOfPlace(place);
    if (chat && remoteSeen == null) return null;         // the backend's mark is on its way: decide then
    const local = seen.get(place);
    const remote = chat && remoteSeen && remoteSeen[chat] != null ? remoteSeen[chat] : null;
    const at = local == null && remote == null ? null : Math.max(local ?? 0, remote ?? 0); // any device looking counts
    const s = at != null && Date.now() - at >= R.AWAY_MS ? at : null;
    since.set(place, s);
    if (at == null) markPlace(place); // first visit ever: nothing to catch up on, but from now on there is
    return s;
  }
  /** Leaving a view: the place it belonged to is seen, unless you're only moving inside it. */
  function leave(from, to) {
    const a = placeOf(from), b = to == null ? null : placeOf(to);
    if (a && a !== b) markPlace(a);
  }
  // a hidden tab counts as gone: back after AWAY_MS, every place speaks again
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    const v = currentView();
    if (document.hidden) { hiddenAt = Date.now(); const p = v && placeOf(v); if (p) markPlace(p); return; }
    if (hiddenAt && Date.now() - hiddenAt >= R.AWAY_MS) { since.clear(); done.clear(); more.clear(); schedule(); }
  });
  addEventListener("pagehide", () => { const v = currentView(); const p = v && placeOf(v); if (p) markPlace(p); });
  let currentView = () => null;

  // ── worktrees: the git words ────────────────────────────────────────────
  function treesFor(chat = "") {
    const c = trees.get(chat);
    if (!c || (!c.loading && Date.now() - c.at > TREES_MS)) {
      const entry = { at: Date.now(), loading: true, map: c ? c.map : new Map() };
      trees.set(chat, entry);
      api.worktrees(chat || undefined).then((d) => {
        entry.map = new Map((d.worktrees || []).map((w) => [w.thread_ts, w]));
        // a newer backend: threads whose worktree was removed, with their branch's last git state
        for (const w of d.removed || []) if (w && w.thread_ts && !entry.map.has(w.thread_ts)) entry.map.set(w.thread_ts, { ...w, exists: false });
      }).catch(() => { /* no git words: the groups still hold */ }).finally(() => { entry.loading = false; entry.at = Date.now(); schedule(); });
    }
    return trees.get(chat).map;
  }

  // ── Since you left ──────────────────────────────────────────────────────
  function needingSet(needs) { return new Set(needs.filter((n) => n.admitted && !n.later).map((n) => n.t.id)); }

  function gitHtml(git) {
    return git.word ? `<span class="syl-git g-${git.group}">${esc(git.word)}</span>` : "";
  }
  function cardHead(place, s, counts, extra = "") {
    const h = R.headline(counts);
    return `<header class="syl-hd"><div class="syl-hw"><p class="syl-k">${ICON.clock}<span>Since you left · ${esc(R.sinceWord(s))}, ${esc(R.awayWord(s))} ago</span></p>` +
      `<h2 class="syl-t">${esc(h.lead)} <em>${esc(h.tail)}</em></h2></div>` +
      `<button type="button" class="syl-got" data-rec-got="${esc(place)}">Got it</button>${extra}</header>`;
  }

  /** The project's card, into #since (shown under the header, outside the scrolling conversation). */
  function projectSince(pid, needs) {
    const box = $("#since");
    const place = pid ? "p:" + pid : null;
    const s = place ? arrive(place) : null;
    if (!place || s == null || done.has(place)) { box.hidden = true; if (box._h) { box.innerHTML = ""; box._h = ""; } return; }
    const p = world.project(pid);
    const map = p && p.chatId ? treesFor(p.chatId) : new Map();
    const cu = R.catchUp(threadsIn(pid), { since: s, needing: needingSet(needs), trees: map });
    if (!cu.total) { box.hidden = true; box.innerHTML = ""; box._h = ""; return; }
    const all = more.has(place);
    let left = all ? Infinity : LINES;
    let body = "";
    for (const g of cu.groups) {
      if (left <= 0) break;
      const items = g.items.slice(0, left);
      left -= items.length;
      body += `<p class="syl-gh"><i class="t-${g.tone}" aria-hidden="true"></i>${esc(g.label)}${g.why ? `<span> · ${esc(g.why)}</span>` : ""}</p>` +
        items.map(({ t, line, git }) => `<button type="button" class="syl-ln" data-go="t:${esc(t.id)}"><span class="syl-tt"><b>${esc(t.title)}</b>${line ? `<small>${esc(line)}</small>` : ""}</span>${gitHtml(git)}<span class="syl-ch" aria-hidden="true">${ICON.right}</span></button>`).join("");
    }
    const hidden = cu.total - Math.min(cu.total, all ? cu.total : LINES);
    const made = madeOf(pid).filter((m) => m.at > s).length;
    const foot = [hidden > 0 ? `<button type="button" class="syl-more" data-rec-more="${esc(place)}">+${hidden} more</button>` : "",
      made ? `<button type="button" class="syl-more is-made" data-made-open="${esc(pid)}">${ICON.spark}${made} ${made === 1 ? "thing" : "things"} made</button>` : ""].filter(Boolean).join("");
    const html = `<section class="syl" aria-label="Since you left">${cardHead(place, s, cu.counts)}<div class="syl-b">${body}</div>${foot ? `<footer class="syl-f">${foot}</footer>` : ""}</section>`;
    box.hidden = false;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }

  /** Home's card: one line per project that moved, its groups as counts. "" when there's nothing to say. */
  function homeSinceHtml(needs) {
    const s = arrive("home");
    if (s == null || done.has("home")) return "";
    const map = treesFor("");
    const needing = needingSet(needs);
    const total = {};
    const rows = [];
    for (const p of world.state.projects || []) {
      if (!p || p.id === "workspace") continue;
      const cu = R.catchUp(threadsIn(p.id), { since: s, needing, trees: map });
      if (!cu.total) continue;
      for (const [k, n] of Object.entries(cu.counts)) total[k] = (total[k] || 0) + n;
      const chips = cu.groups.map((g) => `<span class="syl-chip"><i class="t-${g.tone}" aria-hidden="true"></i>${g.items.length} ${esc(g.label.toLowerCase())}</span>`).join("");
      rows.push({ at: Math.max(...cu.groups.flatMap((g) => g.items.map((x) => x.t.lastAt))), html: `<button type="button" class="syl-ln is-p" data-go="p:${esc(p.id)}"><span class="syl-p">${esc(p.name || p.id)}</span><span class="syl-chips">${chips}</span><span class="syl-ch" aria-hidden="true">${ICON.right}</span></button>` });
    }
    if (!rows.length) return "";
    rows.sort((a, b) => b.at - a.at);
    return `<section class="syl is-home" aria-label="Since you left">${cardHead("home", s, total)}<div class="syl-b">${rows.map((r) => r.html).join("")}</div></section>`;
  }

  // ── Made ────────────────────────────────────────────────────────────────
  const M = { pid: null, kind: "all", q: "", host: null, built: false };
  let panel = null;
  const shown = () => !!(M.host && !M.host.hidden && panel && panel.isOpen);
  /** The project a view belongs to, or null (Home, the Workspace, Chats: every project). */
  const pidOf = (v) => (!v ? null : v.startsWith("p:") ? v.slice(2) : v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
  const thumbs = new Map(); // key → object URL, or "" when it couldn't be read

  // the backend's Made, per chat: {at, loading, rows} while it answers, {off} when it has no such route
  const served = new Map();
  const MADE_MS = 30000;
  function servedRows(chat) {
    if (!chat) return null;
    let c = served.get(chat);
    if (c && c.off) return null;
    if (!c || (!c.loading && Date.now() - c.at > MADE_MS)) {
      const entry = { at: Date.now(), loading: true, rows: c ? c.rows : null, off: false };
      served.set(chat, entry);
      api.made(chat, { limit: 200 }).then((d) => { entry.rows = Array.isArray(d.made) ? d.made : null; if (!entry.rows) entry.off = true; })
        .catch((err) => { if (err.status === 404 || err.status === 405) entry.off = true; /* else: try again later, the fallback meanwhile */ })
        .finally(() => { entry.loading = false; entry.at = Date.now(); schedule(); if (shown()) madeRender(); });
      c = entry;
    }
    return c.rows;
  }
  const titleOf = (ts) => world.thread(ts)?.title || "";
  function madeIn(pid) {
    const chat = world.project(pid)?.chatId;
    const rows = servedRows(chat);
    if (rows) return R.madeFromServer(rows, { project: pid, title: titleOf }).map((m) => ({ ...m, chat }));
    return R.madeItems(threadsIn(pid), { pins });
  }
  const madeOf = (pid) => (pid ? madeIn(pid) : (world.state.projects || []).filter((p) => p && p.id !== "workspace").flatMap((p) => madeIn(p.id)).sort((a, b) => b.at - a.at));
  const madeCount = (pid) => madeOf(pid).length;

  function thumbHtml(m) {
    if (m.kind === "image") {
      const u = thumbs.get(m.key);
      if (u) return `<img src="${esc(u)}" alt="" decoding="async">`;
    }
    const tag = m.kind === "link" ? hostOf(m.url) : m.kind === "branch" ? R.gitState(null, m.git).word || "branch" : (/\.([\w-]+)$/.exec(m.name) || [])[1] || R.KIND_WORD[m.kind];
    const ic = m.kind === "link" || m.kind === "branch" ? KIND_IC[m.kind] : fileIcon(m.name || m.path);
    return `<span class="md-ic">${ic}</span><span class="md-ext${m.kind === "link" || m.kind === "branch" ? " is-word" : ""}">${esc(tag)}</span>`;
  }
  /** Image files show themselves: each read once, through its thread's folder. */
  function loadThumbs(items) {
    for (const m of items) {
      if (m.kind !== "image" || thumbs.has(m.key)) continue;
      const r = m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : m.server ? {} : sharedFileRoute(world.thread(m.tid), m.path);
      if (m.exists === false) { thumbs.set(m.key, ""); continue; }
      if (!r.project) { thumbs.set(m.key, ""); continue; }
      thumbs.set(m.key, "");
      api.projectImage(r.project, r.rel).then((b) => { thumbs.set(m.key, URL.createObjectURL(b)); schedule(); if (shown()) madeRender(); }).catch(() => {});
    }
  }
  const hostOf = (u) => { try { return new URL(u).host; } catch { return "link"; } };
  const size = (n) => (n == null || n === "" ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  function cardHtml(m, { where = false } = {}) {
    const meta = [m.exists === false ? "Gone" : R.KIND_WORD[m.kind], size(m.bytes), short(m.at) === "now" ? "now" : short(m.at) + " ago"].filter(Boolean).join(" · ");
    return `<li class="md-it${m.pinned ? " is-pin" : ""}${m.exists === false ? " is-gone" : ""}">` +
      `<button type="button" class="md-open" data-made-file="${esc(m.key)}" title="${esc(m.path)}" aria-label="Open ${esc(m.name)}"><span class="md-th k-${m.kind}">${thumbHtml(m)}</span>` +
      `<span class="md-meta"><b>${esc(m.name)}</b><span>${esc(where ? `${PROJ(m.project)} · ${short(m.at) === "now" ? "now" : short(m.at) + " ago"}` : meta)}</span></span></button>` +
      (where || !m.tid ? "" : `<button type="button" class="md-from" data-made-go="t:${esc(m.tid)}" title="Open the thread that made it">${ICON.back}<span>${esc(m.title || "Its thread")}</span></button>`) +
      `<button type="button" class="md-pin" data-made-pin="${esc(m.key)}" aria-pressed="${m.pinned}" aria-label="${m.pinned ? "Unpin" : "Pin"} ${esc(m.name)}" title="${m.pinned ? "Unpin" : "Pin it on top"}">${ICON.pin}</button></li>`;
  }

  // A card is made once and then updated in place (js/motion.js): its time, pin and picture change
  // without redrawing it, so a picture never flashes; a new card arrives, the rest glide aside.
  const tpl = document.createElement("template");
  const cardMake = (where) => (m) => {
    tpl.innerHTML = cardHtml(m, { where }).trim();
    const el = tpl.content.firstElementChild;
    fadeImage(el.querySelector(".md-th img"));
    return el;
  };
  const cardUpdate = (where) => (el, m) => {
    tpl.innerHTML = cardHtml(m, { where }).trim();
    const nx = tpl.content.firstElementChild;
    el.className = nx.className;
    const th = el.querySelector(".md-th"), th2 = nx.querySelector(".md-th");
    if (th && th2) { th.className = th2.className; if (setHtml(th, th2.innerHTML)) fadeImage(th.querySelector("img")); }
    setText(el.querySelector(".md-meta b"), nx.querySelector(".md-meta b").textContent);
    setText(el.querySelector(".md-meta span"), nx.querySelector(".md-meta span").textContent);
    const fr = el.querySelector(".md-from span"), fr2 = nx.querySelector(".md-from span");
    if (fr && fr2) setText(fr, fr2.textContent);
    for (const sel of [".md-open", ".md-pin"]) {
      const a = el.querySelector(sel), b = nx.querySelector(sel);
      if (a && b) for (const at of ["title", "aria-label", "aria-pressed", "data-made-file", "data-made-pin"]) { const v = b.getAttribute(at); if (v != null && a.getAttribute(at) !== v) a.setAttribute(at, v); }
    }
  };
  const syncCards = (ul, items, where) => syncList(ul, items, { make: cardMake(where), update: cardUpdate(where) });

  function madeRender() {
    if (!M.host) return;
    const pid = M.pid && world.project(M.pid) ? M.pid : null;
    const items = madeOf(pid);
    const counts = Object.fromEntries(R.KINDS.map(([k]) => [k, k === "all" ? items.length : items.filter((m) => m.kind === k).length]));
    const list = R.filterMade(items, { kind: M.kind, q: M.q });
    const groups = R.madeGroups(list);
    loadThumbs(list);
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
    const f = R.KINDS.filter(([k]) => k === "all" || counts[k]).map(([k, w]) => `<button type="button" role="radio" data-made-kind="${k}" aria-checked="${M.kind === k}">${w}<span>${counts[k]}</span></button>`).join("");
    const fe = h.querySelector("#made-f");
    if (fe._h !== f) { fe.innerHTML = f; fe._h = f; }
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
  function togglePin(key) {
    const m = madeOf(null).find((x) => x.key === key);
    const on = m ? !m.pinned : !pins.has(key);
    if (m && m.server && m.chat) {
      // the backend's pin, for every device: shown at once, put back if it's refused
      const row = (served.get(m.chat)?.rows || []).find((r) => r.id === m.id);
      if (row) row.pinned = on;
      api.pinMade(m.chat, m.id, on).catch((err) => { if (row) row.pinned = !on; announce(`Couldn't ${on ? "pin" : "unpin"} it: ${err.message}`); schedule(); if (shown()) madeRender(); });
    } else {
      if (on) pins.add(key); else pins.delete(key);
      savePins();
    }
    announce(on ? "Pinned" : "Unpinned");
    if (shown()) madeRender();
    schedule();
  }

  /** Recently made, on Home: the newest few across every project, pinned ones first. Kept in place:
   *  a new thing arrives at the front and the others glide along; nothing else is redrawn. */
  function homeMade(box) {
    const items = madeOf(null);
    if (!box._built) {
      box.innerHTML = `<section class="md-recent" aria-labelledby="md-recent-h" hidden><h2 class="hm-lbl" id="md-recent-h">${ICON.spark}Recently made</h2><ul class="md-grid is-strip"></ul></section>`;
      box._built = true;
    }
    const sec = box.querySelector(".md-recent");
    sec.hidden = !items.length;
    if (!items.length) return;
    const list = [...items.filter((m) => m.pinned), ...items.filter((m) => !m.pinned)].slice(0, RECENT);
    loadThumbs(list);
    syncCards(sec.querySelector(".md-grid"), list, true);
  }

  /** ⌘K: made files by name, only once you've typed something. */
  function jumpItems(q) {
    if (!q) return [];
    const w = q.toLowerCase();
    return madeOf(null).filter((m) => `${m.name} ${m.path}`.toLowerCase().includes(w)).slice(0, 8)
      .map((m) => ({ name: m.name, sub: `Made in ${PROJ(m.project)}${m.title ? ` · ${m.title}` : ""}`, icon: KIND_IC[m.kind] || ICON.doc, run: () => { if (m.kind !== "link" && m.tid) go("t:" + m.tid); openFile(m.key, null); } }));
  }

  // ── events ──────────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const t = e.target;
    const got = t.closest("[data-rec-got]");
    if (got) { const p = got.dataset.recGot; done.add(p); markPlace(p); announce("Caught up"); schedule(); return; }
    const mr = t.closest("[data-rec-more]");
    if (mr) { more.add(mr.dataset.recMore); schedule(); return; }
    const mo = t.closest("[data-made-open]");
    if (mo && panel) { panel.open("made"); return; }
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

  return {
    placeOf, leave, projectSince, homeSinceHtml, homeMade, madeCount, jumpItems,
    /** The panel's Made tab. */
    made: { mount, show: showMade, count: (v) => madeOf(pidOf(v)).length },
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
    /** app.js tells it where you are, for the tab's hide and close. */
    set view(fn) { currentView = fn; },
  };
}
