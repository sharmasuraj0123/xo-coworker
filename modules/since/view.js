// @ts-check

// Since you left on screen: when you last looked at each place, the quiet line under a project's header, Home's lines, and Got it.

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import { AWAY_MS, catchUp, sinceWord, createSeen } from "./model.js";

const TREES_MS = 60000;     // worktrees read at most this often per chat

/** @param {{ world: any, api: any, schedule: () => void, announce: (words: string) => void }} deps */
export function createSince({ world, api, schedule, announce }) {
  const seen = createSeen(localStorage);
  /** @type {Map<string, number | null>} */
  const since = new Map();        // place → when you'd last looked, if you were away long enough; null: nothing to say
  const done = new Set();         // places whose line you dismissed in this page
  /** @type {Map<string, { at: number, loading: boolean, map: Map<string, any> }>} */
  const trees = new Map();        // chat id ("" for all) → {at, loading, map: thread ts → worktree}
  /** @param {string} pid */
  const threadsIn = (pid) => world.state.threads.filter((/** @type {any} */ t) => t.project === pid);

  /** The place a view belongs to: a thread is part of its project; chats and the Workspace keep no record. @param {string} v @returns {string | null} */
  function placeOf(v) {
    if (v === "home") return "home";
    if (v.startsWith("p:")) return v;
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); return t && t.project && t.project !== "workspace" ? "p:" + t.project : null; }
    return null;
  }
  /** @type {Record<string, number | null> | null} */
  let remoteSeen = null; // the backend's seen marks, per project chat; null until read, {} when it has none
  api.chats().then((/** @type {any} */ d) => {
    /** @type {Record<string, number | null>} */
    const m = {};
    for (const c of d.chats || []) if (c && "seen" in c) m[c.id] = c.seen ? Date.parse(c.seen.seen_at) || null : null;
    remoteSeen = m;
  }).catch(() => { remoteSeen = {}; }).finally(() => schedule());
  /** @param {string | null} place @returns {string | null} */
  const chatOfPlace = (place) => (place && place.startsWith("p:") ? world.project(place.slice(2))?.chatId || null : null);
  /** @param {string} place */
  function markPlace(place) {
    seen.mark(place);
    const chat = chatOfPlace(place);
    if (chat && remoteSeen && chat in remoteSeen) { remoteSeen[chat] = Date.now(); api.markSeen(chat).catch(() => { /* this browser's mark still holds */ }); }
  }
  /** First arrival at a place in this page: were you away long enough to be told what happened? @param {string} place @returns {number | null} */
  function arrive(place) {
    if (since.has(place)) return /** @type {number | null} */ (since.get(place));
    const chat = chatOfPlace(place);
    if (chat && remoteSeen == null) return null;         // the backend's mark is on its way: decide then
    const local = seen.get(place);
    const remote = chat && remoteSeen && remoteSeen[chat] != null ? remoteSeen[chat] : null;
    const at = local == null && remote == null ? null : Math.max(local ?? 0, remote ?? 0); // any device looking counts
    const s = at != null && Date.now() - at >= AWAY_MS ? at : null;
    since.set(place, s);
    if (at == null) markPlace(place); // first visit ever: nothing to catch up on, but from now on there is
    return s;
  }
  /** Leaving a view: the place it belonged to is seen, unless you're only moving inside it. @param {string} from @param {string | null} [to] */
  function leave(from, to) {
    const a = placeOf(from), b = to == null ? null : placeOf(to);
    if (a && a !== b) markPlace(a);
  }
  // a hidden tab counts as gone: back after AWAY_MS, every place speaks again
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    const v = currentView();
    if (document.hidden) { hiddenAt = Date.now(); const p = v && placeOf(v); if (p) markPlace(p); return; }
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) { since.clear(); done.clear(); schedule(); }
  });
  addEventListener("pagehide", () => { const v = currentView(); const p = v && placeOf(v); if (p) markPlace(p); });
  /** @type {() => string | null} */
  let currentView = () => null;

  /** The worktrees of a chat ("" for all), by thread: the git words; read again after TREES_MS. @param {string} [chat] */
  function treesFor(chat = "") {
    const c = trees.get(chat);
    if (!c || (!c.loading && Date.now() - c.at > TREES_MS)) {
      const entry = { at: Date.now(), loading: true, map: c ? c.map : new Map() };
      trees.set(chat, entry);
      api.worktrees(chat || undefined).then((/** @type {any} */ d) => {
        entry.map = new Map((d.worktrees || []).map((/** @type {any} */ w) => [w.thread_ts, w]));
        // a newer backend: threads whose worktree was removed, with their branch's last git state
        for (const w of d.removed || []) if (w && w.thread_ts && !entry.map.has(w.thread_ts)) entry.map.set(w.thread_ts, { ...w, exists: false });
      }).catch(() => { /* no git words: the groups still hold */ }).finally(() => { entry.loading = false; entry.at = Date.now(); schedule(); });
    }
    return /** @type {{ map: Map<string, any> }} */ (trees.get(chat)).map;
  }

  /** @param {any[]} needs */
  function needingSet(needs) { return new Set(needs.filter((n) => n.admitted && !n.later).map((n) => n.t.id)); }

  /** "Since Friday · 3 finished · 1 not pushed · 1 needs you": each part opens its newest thread. @param {ReturnType<typeof catchUp>} cu */
  function partsHtml(cu) {
    return cu.groups.map((g) => { const t = g.items[0].t; return `<button type="button" class="sl-part t-${g.tone}" data-go="t:${esc(t.id)}" title="${esc(g.items.map((x) => x.t.title).join(" · "))}">${g.items.length} ${esc(g.label.toLowerCase())}</button>`; }).join(`<span class="sl-sep" aria-hidden="true">·</span>`);
  }
  /** The one line under a project's header, into #since, after AWAY_MS away; gone on Got it. @param {string | null} pid @param {any[]} needs */
  function sinceLine(pid, needs) {
    const box = /** @type {any} */ (document.getElementById("since"));
    if (!box) return;
    const place = pid ? "p:" + pid : null;
    const s = place ? arrive(place) : null;
    const off = () => { box.hidden = true; if (box._h) { box.innerHTML = ""; box._h = ""; } };
    if (!place || s == null || done.has(place)) return off();
    const p = world.project(pid);
    const cu = catchUp(threadsIn(/** @type {string} */ (pid)), { since: s, needing: needingSet(needs), trees: p && p.chatId ? treesFor(p.chatId) : new Map() });
    if (!cu.total) return off();
    const html = `<p class="sl" role="status">${ICON.clock}<span class="sl-k">Since ${esc(sinceWord(s))}</span>${partsHtml(cu)}<button type="button" class="sl-x" data-rec-got="${esc(place)}" aria-label="Got it" title="Got it">${ICON.close}</button></p>`;
    box.hidden = false;
    if (box._h !== html) { redraw(box, html); box._h = html; } // in place: its buttons stay the same nodes as counts change
  }
  /** Home's lines: one per project that moved, newest first, five at most; "" when there's nothing to say. @param {any[]} needs */
  function homeSinceLines(needs) {
    const s = arrive("home");
    if (s == null || done.has("home")) return "";
    /** @type {{ at: number, html: string }[]} */
    const rows = [];
    const map = treesFor(""), needing = needingSet(needs);
    for (const p of world.state.projects || []) {
      if (!p || p.id === "workspace") continue;
      const cu = catchUp(threadsIn(p.id), { since: s, needing, trees: map });
      if (cu.total) rows.push({ at: Math.max(...cu.groups.flatMap((g) => g.items.map((x) => x.t.lastAt))), html: `<p class="sl is-home"><button type="button" class="sl-p" data-go="p:${esc(p.id)}">${esc(p.name || p.id)}</button>${partsHtml(cu)}</p>` });
    }
    if (!rows.length) return "";
    rows.sort((a, b) => b.at - a.at);
    return `<section class="sl-home" aria-label="Since you were away"><p class="sl-k">${ICON.clock}Since ${esc(sinceWord(s))}<button type="button" class="sl-x" data-rec-got="home" aria-label="Got it" title="Got it">${ICON.close}</button></p>${rows.slice(0, 5).map((r) => r.html).join("")}</section>`;
  }

  document.addEventListener("click", (e) => {
    const got = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.("[data-rec-got]"));
    if (!got) return;
    const p = /** @type {string} */ (got.dataset.recGot);
    // the line goes with its button: focus moves first to the place it was read in (Home, or the conversation), never the page
    if (got.contains(document.activeElement)) document.getElementById(p === "home" ? "home" : "scroller")?.focus({ preventScroll: true });
    done.add(p); markPlace(p); announce("Caught up"); schedule();
  });

  return {
    placeOf, leave, sinceLine, homeSinceLines,
    /** @param {() => string | null} fn */
    set view(fn) { currentView = fn; },
  };
}
