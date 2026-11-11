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
// A made file with a title (xo-space 8c6bc03) is named by it, its file name on the card's second line (in
// place of the kind word) and in its tooltip; untitled, its name cuts in the middle. The thread that made
// it is `threadTitle` (record.js keeps the two apart).
// "Seen" is the backend's per chat when it has it (the later of it and this browser's), else this
// browser's; the thread's `summary` and `git` state make the card's words exact when they're there.
//
// app.js calls: placeOf, leave, projectSince, homeSinceHtml, homeMade, madeCount, jumpItems, and
// the panel's Made tab (made: mount, show, count); `panel` is set to the panel once it exists.

import { syncList, fadeImage, setHtml, setText } from "./motion.js";
import { redraw } from "./redraw.js";
import { radioKeys, rovingTab } from "./keynav.js";
import * as R from "./record.js";
import { api } from "./api.js";
import { esc } from "./util.js";
import { ICON, $, short } from "./ui.js";
import { sharedFileRoute } from "./timeline.js";
import { fileIcon } from "./fileicons.js";
import { midName, midNameHtml } from "./media.js";
import { skTile, bar as skBar, rememberedMade } from "./skeleton.js";

const PINS = "xo-made-pins";
const TREES_MS = 60000;     // worktrees read at most this often per chat
const LINES = 6;            // a card's lines before "+N more"
const RECENT = 6;           // Recently made on Home

const KIND_IC = { image: ICON.image, page: ICON.globe, doc: ICON.doc, data: ICON.list, code: ICON.edit, link: ICON.arrow, branch: ICON.branch };
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
  function arrive(place) {
    if (since.has(place)) return since.get(place);
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

  /** The quiet form (the owner removed the card on 2026-11-04 and chose this one line on 2026-11-08): after
      AWAY_MS away, one line under a project's header, "Since Friday · 3 finished · 1 not pushed · 1 needs you",
      each part opening its newest thread, and a dismiss. Home: the same line per project that moved. */
  function partsHtml(cu) {
    return cu.groups.map((g) => { const t = g.items[0].t; return `<button type="button" class="sl-part t-${g.tone}" data-go="t:${esc(t.id)}" title="${esc(g.items.map((x) => x.t.title).join(" · "))}">${g.items.length} ${esc(g.label.toLowerCase())}</button>`; }).join(`<span class="sl-sep" aria-hidden="true">·</span>`);
  }
  function sinceLine(pid, needs) {
    const box = $("#since");
    if (!box) return;
    const place = pid ? "p:" + pid : null;
    const s = place ? arrive(place) : null;
    const off = () => { box.hidden = true; if (box._h) { box.innerHTML = ""; box._h = ""; } };
    if (!place || s == null || done.has(place)) return off();
    const p = world.project(pid);
    const cu = R.catchUp(threadsIn(pid), { since: s, needing: needingSet(needs), trees: p && p.chatId ? treesFor(p.chatId) : new Map() });
    if (!cu.total) return off();
    const html = `<p class="sl" role="status">${ICON.clock}<span class="sl-k">Since ${esc(R.sinceWord(s))}</span>${partsHtml(cu)}<button type="button" class="sl-x" data-rec-got="${esc(place)}" aria-label="Got it" title="Got it">${ICON.close}</button></p>`;
    box.hidden = false;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }
  function homeSinceLines(needs) {
    const s = arrive("home");
    if (s == null || done.has("home")) return "";
    const map = treesFor(""), needing = needingSet(needs), rows = [];
    for (const p of world.state.projects || []) {
      if (!p || p.id === "workspace") continue;
      const cu = R.catchUp(threadsIn(p.id), { since: s, needing, trees: map });
      if (cu.total) rows.push({ at: Math.max(...cu.groups.flatMap((g) => g.items.map((x) => x.t.lastAt))), html: `<p class="sl is-home"><button type="button" class="sl-p" data-go="p:${esc(p.id)}">${esc(p.name || p.id)}</button>${partsHtml(cu)}</p>` });
    }
    if (!rows.length) return "";
    rows.sort((a, b) => b.at - a.at);
    return `<section class="sl-home" aria-label="Since you were away"><p class="sl-k">${ICON.clock}Since ${esc(R.sinceWord(s))}<button type="button" class="sl-x" data-rec-got="home" aria-label="Got it" title="Got it">${ICON.close}</button></p>${rows.slice(0, 5).map((r) => r.html).join("")}</section>`;
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

  // The backend's Made, per chat: {at, loading, rows, more, v} while it answers, {off} when it has no such route.
  // The newest page is read when something shows Made (and again every MADE_MS); `more` is where the next older
  // page starts, read only for the Artifacts page (olderPages), which filters everything there is. Until a chat's
  // first answer the record is `pending`: Home and Artifacts hold the place with stand-ins rather than show the
  // older backend's fallback (what threads shared) and swap it a moment later.
  const served = new Map();
  const MADE_MS = 30000;
  const PAGE_FIRST = 200, PAGE_MORE = 500, PAGES_MAX = 40; // the Space's limit is 500 a page
  function servedRows(chat) {
    if (!chat) return null;
    let c = served.get(chat);
    if (c && c.off) return null;
    if (!c || (!c.loading && Date.now() - c.at > MADE_MS)) {
      const entry = { at: Date.now(), loading: true, rows: c ? c.rows : null, off: false, tried: !!c, more: c ? c.more : null, end: c ? c.end : false, pages: c ? c.pages : 0, paging: false, v: c ? c.v + 1 : 0 };
      served.set(chat, entry);
      api.made(chat, { limit: PAGE_FIRST }).then((d) => {
        if (!Array.isArray(d.made)) { entry.rows = null; entry.off = true; return; }
        // the newest page: merged with older ones already read (they stay), or everything there is
        const complete = !d.next_before;
        entry.rows = R.mergeMadeRows(entry.rows, d.made, { first: true, complete });
        // older pages: once read to the end they're kept (anything touched since comes back on the newest page)
        entry.more = complete || entry.end ? null : entry.more ?? d.next_before;
        entry.v++;
      }).catch((err) => { if (err.status === 404 || err.status === 405) entry.off = true; /* else: try again later, the fallback meanwhile */ })
        .finally(() => { entry.loading = false; entry.tried = true; entry.at = Date.now(); schedule(); if (shown()) madeRender(); });
      c = entry;
    }
    return c.rows;
  }
  /** A chat whose Made hasn't answered yet, the first time it's asked. */
  const pendingChat = (chat) => { const c = chat ? served.get(chat) : null; return !!(c && c.loading && !c.tried && c.rows == null && !c.off); };
  const projectsMade = () => (world.state.projects || []).filter((p) => p && p.id !== "workspace");
  /** Is what was made still on its way (pid's, or every project's)? Asking starts the reading. Once every
   *  project's has come, it has: a project added later brings its things when they come, without stand-ins. */
  let settled = false;
  function madePending(pid) {
    const ps = pid ? [world.project(pid)].filter(Boolean) : projectsMade();
    let any = false;
    for (const p of ps) { servedRows(p.chatId); if (pendingChat(p.chatId)) any = true; }
    if (!pid && !any && ps.length) settled = true;
    return any && !(settled && !pid);
  }
  /** The Artifacts page reads what's older too, a page at a time, in the background (each page lands below). */
  function olderPages() {
    for (const p of projectsMade()) {
      const e = served.get(p.chatId);
      if (!e || e.off || e.paging || !e.rows || !e.more || e.pages >= PAGES_MAX) continue;
      const before = R.olderCursor(e.more);
      if (!before) { e.more = null; continue; }
      e.paging = true;
      api.made(p.chatId, { limit: PAGE_MORE, before }).then((d) => {
        if (!Array.isArray(d.made)) { e.more = null; return; }
        const n0 = e.rows.length;
        e.rows = R.mergeMadeRows(e.rows, d.made);
        e.pages++;
        // a page that brought nothing new (every row was a repeat) or the last one: that's all there is
        e.more = d.next_before && e.rows.length > n0 && d.next_before !== e.more ? d.next_before : null;
        if (!e.more) e.end = true;
        e.v++;
      }).catch(() => { /* the next look tries again */ }).finally(() => { e.paging = false; schedule(); });
    }
  }
  // Made items, kept between renders: a chat's are worked out again only when its rows, its pins or the
  // threads' titles change (the page can hold thousands, and the sidebar counts them on every render)
  let titlesOf = null, titles = new Map(), pinsV = 0;
  const threadTitleOf = (ts) => {
    if (titlesOf !== world.state.threads) { titlesOf = world.state.threads; titles = new Map(titlesOf.map((t) => [t.id, t.title || ""])); }
    return titles.get(ts) || "";
  };
  const memo = new Map(); // pid → {key, items}
  function madeIn(pid) {
    const chat = world.project(pid)?.chatId;
    const rows = servedRows(chat);
    threadTitleOf("");
    const e = served.get(chat);
    const key = rows ? `s|${e.v}|${rows.length}` : `f|${pinsV}`;
    const m = memo.get(pid);
    if (m && m.key === key && m.titles === titles && (rows || m.threads === world.state.threads)) return m.items;
    const items = rows ? R.madeFromServer(rows, { project: pid, threadTitle: threadTitleOf }).map((x) => ({ ...x, chat })) : R.madeItems(threadsIn(pid), { pins });
    memo.set(pid, { key, titles, threads: world.state.threads, items });
    return items;
  }
  // the sidebar's count: a project read to its end counts what it has, and keeps that count (this browser, per chat) for
  // next time; one whose older pages aren't read yet shows the larger of what's read and that kept count. It showed the
  // newest pages' 348, then 1738 once Artifacts read the rest (the owner, 11 Nov 08:06Z). The Space gives no total
  const FULL_KEY = (chat) => `xo-made-n:${chat}`;
  const fullOf = (chat) => { try { return +localStorage.getItem(FULL_KEY(chat)) || 0; } catch { return 0; } };
  function madeCountAll(pending) {
    let n = 0;
    for (const p of projectsMade()) {
      const e = served.get(p.chatId);
      if (pending && !(e && e.rows)) { n += fullOf(p.chatId); continue; }
      const items = madeIn(p.id).length;
      if (!e || e.off || (e.rows && !e.more)) {
        if (e && e.rows && fullOf(p.chatId) !== items) { try { localStorage.setItem(FULL_KEY(p.chatId), String(items)); } catch { /* private mode */ } }
        n += items;
      } else n += Math.max(items, fullOf(p.chatId));
    }
    return n;
  }
  let allMemo = { parts: [], items: [] };
  function madeOf(pid) {
    if (pid) return madeIn(pid);
    const parts = projectsMade().map((p) => madeIn(p.id));
    if (parts.length === allMemo.parts.length && parts.every((x, i) => x === allMemo.parts[i])) return allMemo.items;
    allMemo = { parts, items: parts.flat().sort((a, b) => b.at - a.at) };
    return allMemo.items;
  }
  const madeCount = (pid) => madeOf(pid).length;

  function thumbHtml(m) {
    if (m.kind === "image") {
      const u = thumbs.get(m.key);
      if (u) return `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">`;
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
  /** A card. where: false in a project's Made, true on Home's strip (the project instead of the
   *  kind), "page" on the Artifacts page (the project, the kind and the thread that made it). */
  function cardHtml(m, { where = false } = {}) {
    const ago = short(m.at) === "now" ? "now" : short(m.at) + " ago";
    const n = madeNaming(m);
    // a titled file's name takes the kind word's place (its thumbnail already says the kind); gone says gone
    const what = m.exists === false ? "Gone" : m.title ? n.file : R.KIND_WORD[m.kind];
    // on the page a card says where it's from, what it is and when; its size is in the file itself
    const meta = (where === "page" ? [PROJ(m.project), what, ago] : [what, size(m.bytes), ago]).filter(Boolean).join(" · ");
    return `<li class="md-it${m.pinned ? " is-pin" : ""}${m.exists === false ? " is-gone" : ""}">` +
      `<button type="button" class="md-open" data-made-file="${esc(m.key)}" title="${esc(n.tip)}" aria-label="Open ${esc(n.label)}"><span class="md-th k-${m.kind}">${thumbHtml(m)}</span>` +
      `<span class="md-meta"><b>${n.html}</b><span>${esc(where === true ? `${PROJ(m.project)} · ${ago}` : meta)}</span></span></button>` +
      (where === true ? "" : m.tid ? `<button type="button" class="md-from" data-made-go="t:${esc(m.tid)}" title="Open the thread that made it">${ICON.back}<span>${esc(n.from)}</span></button>`
        : where === "page" ? `<span class="md-from is-none" aria-hidden="true"><span>&nbsp;</span></span>` : "") + // on the page every card is one height
      `<button type="button" class="md-pin" data-made-pin="${esc(m.key)}" aria-pressed="${m.pinned}" aria-label="${m.pinned ? "Unpin" : "Pin"} ${esc(n.label)}" title="${m.pinned ? "Unpin" : "Pin it on top"}">${ICON.pin}</button></li>`;
  }

  // A card is made once and then updated in place (js/motion.js): its time, pin and picture change
  // without redrawing it, so a picture never flashes; a new card arrives, the rest glide aside.
  const tpl = document.createElement("template");
  const cardMake = (where) => (m) => {
    const html = cardHtml(m, { where });
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    el._sig = html;
    const th = el.querySelector(".md-th");
    th._h = th.innerHTML;
    fadeImage(th.querySelector("img"));
    return el;
  };
  const cardUpdate = (where) => (el, m) => {
    const html = cardHtml(m, { where });
    if (el._sig === html) return; // nothing about it changed: not even parsed again (a page can hold thousands)
    el._sig = html;
    tpl.innerHTML = html.trim();
    const nx = tpl.content.firstElementChild;
    el.className = nx.className;
    const th = el.querySelector(".md-th"), th2 = nx.querySelector(".md-th");
    if (th && th2) { th.className = th2.className; if (setHtml(th, th2.innerHTML)) fadeImage(th.querySelector("img")); }
    setHtml(el.querySelector(".md-meta b"), nx.querySelector(".md-meta b").innerHTML); // a name cut in the middle is two spans
    // the meta's own line (its age), not a span inside a name cut in the middle (Astra H12: the age went stale)
    setText(el.querySelector(".md-meta > span"), nx.querySelector(".md-meta > span").textContent);
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
  function togglePin(key) {
    const m = madeOf(null).find((x) => x.key === key);
    const on = m ? !m.pinned : !pins.has(key);
    if (m && m.server && m.chat) {
      // the backend's pin, for every device: shown at once, put back if it's refused
      const e = served.get(m.chat);
      const row = (e?.rows || []).find((r) => r.id === m.id);
      if (row) { row.pinned = on; e.v++; }
      api.pinMade(m.chat, m.id, on).catch((err) => { if (row) { row.pinned = !on; e.v++; } announce(`Couldn't ${on ? "pin" : "unpin"} it: ${err.message}`); schedule(); if (shown()) madeRender(); });
    } else {
      if (on) pins.add(key); else pins.delete(key);
      pinsV++;
      savePins();
    }
    announce(on ? "Pinned" : "Unpinned");
    if (shown()) madeRender();
    schedule();
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
    loadThumbs(list);
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
        if (A.tio) for (const c of el.children) if (!c._tw && A.byKey.get(c.dataset.k)?.kind === "image" && !thumbs.has(c.dataset.k)) { c._tw = true; A.tio.observe(c); }
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
          if (m) loadThumbs([m]);
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
    const reading = projectsMade().some((p) => { const e = served.get(p.chatId); return e && !e.off && e.more && !e.end; });
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
    const got = t.closest("[data-rec-got]");
    if (got) {
      const p = got.dataset.recGot;
      // the line goes with its button: focus moves on first, to the place it was read in (Home, or the
      // conversation), never the page (Astra: dismissing left focus on BODY)
      if (got.contains(document.activeElement)) document.getElementById(p === "home" ? "home" : "scroller")?.focus({ preventScroll: true });
      done.add(p); markPlace(p); announce("Caught up"); schedule(); return;
    }
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
    placeOf, leave, projectSince, homeSinceHtml, sinceLine, homeSinceLines, homeMade, madeCount, jumpItems,
    /** The newest file a thread made (not a branch): what its finished card offers to open. */
    latestOf: (tid, project) => madeOf(project || null).find((x) => x.tid === tid && x.kind !== "branch" && x.kind !== "link" && x.exists !== false) || null,
    /** The Artifacts page (a sidebar place): render() draws it; count() is what the sidebar shows. */
    artifacts: { render: artsRender, count: () => madeCountAll(madePending(null)) },
    /** The panel's Made tab. */
    made: { mount, show: showMade, count: (v) => madeOf(pidOf(v)).length },
    set panel(p) { panel = p; },
    refresh() { if (shown()) madeRender(); },
    /** app.js tells it where you are, for the tab's hide and close. */
    set view(fn) { currentView = fn; },
  };
}
