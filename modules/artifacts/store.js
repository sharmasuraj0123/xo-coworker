// @ts-check

// What was made, as the Made tab, Home's strip, the Artifacts page and ⌘K read it: the backend's pages per chat (else what threads shared), memoised, and pins.

import { mergeMadeRows, olderCursor, madeFromServer, madeItems } from "./model.js";

const PINS = "xo-made-pins";

/** @param {{ world: any, api: any, schedule: () => void, announce: (words: string) => void, changed: () => void }} deps */
export function createMadeStore({ world, api, schedule, announce, changed }) {
  /** @type {Set<string>} */
  let pins = new Set();
  try { pins = new Set(JSON.parse(localStorage.getItem(PINS) || "[]")); } catch { /* private mode */ }
  const savePins = () => { try { localStorage.setItem(PINS, JSON.stringify([...pins])); } catch { /* private mode */ } };

  /** @param {string} pid */
  const threadsIn = (pid) => world.state.threads.filter((/** @type {any} */ t) => t.project === pid);

  /** @type {Map<string, any>} The backend's Made, per chat: {at, loading, rows, more, v} while it answers, {off} when it has no such route. The newest page is read when something shows Made (and again every MADE_MS); `more` is where the next older page starts, read only for the Artifacts page (olderPages), which filters everything there is. Until a chat's first answer the record is `pending`: Home and Artifacts hold the place with stand-ins rather than show the older backend's fallback (what threads shared) and swap it a moment later. */
  const served = new Map();
  const MADE_MS = 30000;
  const PAGE_FIRST = 200, PAGE_MORE = 500, PAGES_MAX = 40; // the Space's limit is 500 a page
  /** @param {string | null | undefined} chat @returns {any[] | null} */
  function servedRows(chat) {
    if (!chat) return null;
    let c = served.get(chat);
    if (c && c.off) return null;
    if (!c || (!c.loading && Date.now() - c.at > MADE_MS)) {
      const entry = { at: Date.now(), loading: true, rows: c ? c.rows : null, off: false, tried: !!c, more: c ? c.more : null, end: c ? c.end : false, pages: c ? c.pages : 0, paging: false, v: c ? c.v + 1 : 0 };
      served.set(chat, entry);
      api.made(chat, { limit: PAGE_FIRST }).then((/** @type {any} */ d) => {
        if (!Array.isArray(d.made)) { entry.rows = null; entry.off = true; return; }
        // the newest page: merged with older ones already read (they stay), or everything there is
        const complete = !d.next_before;
        entry.rows = mergeMadeRows(entry.rows, d.made, { first: true, complete });
        // older pages: once read to the end they're kept (anything touched since comes back on the newest page)
        entry.more = complete || entry.end ? null : entry.more ?? d.next_before;
        entry.v++;
      }).catch((/** @type {any} */ err) => { if (err.status === 404 || err.status === 405) entry.off = true; /* else: try again later, the fallback meanwhile */ })
        .finally(() => { entry.loading = false; entry.tried = true; entry.at = Date.now(); schedule(); changed(); });
      c = entry;
    }
    return c.rows;
  }
  /** A chat whose Made hasn't answered yet, the first time it's asked. @param {string | null | undefined} chat */
  const pendingChat = (chat) => { const c = chat ? served.get(chat) : null; return !!(c && c.loading && !c.tried && c.rows == null && !c.off); };
  /** @returns {any[]} */
  const projectsMade = () => (world.state.projects || []).filter((/** @type {any} */ p) => p && p.id !== "workspace");
  /** Is what was made still on its way (pid's, or every project's)? Asking starts the reading. Once every project's has come, it has: a project added later brings its things when they come, without stand-ins. */
  let settled = false;
  /** @param {string | null} pid */
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
      const before = olderCursor(e.more);
      if (!before) { e.more = null; continue; }
      e.paging = true;
      api.made(p.chatId, { limit: PAGE_MORE, before }).then((/** @type {any} */ d) => {
        if (!Array.isArray(d.made)) { e.more = null; return; }
        const n0 = e.rows.length;
        e.rows = mergeMadeRows(e.rows, d.made);
        e.pages++;
        // a page that brought nothing new (every row was a repeat) or the last one: that's all there is
        e.more = d.next_before && e.rows.length > n0 && d.next_before !== e.more ? d.next_before : null;
        if (!e.more) e.end = true;
        e.v++;
      }).catch(() => { /* the next look tries again */ }).finally(() => { e.paging = false; schedule(); });
    }
  }
  /** @type {any} Made items, kept between renders: a chat's are worked out again only when its rows, its pins or the threads' titles change (the page can hold thousands, and the sidebar counts them on every render) */
  let titlesOf = null, titles = new Map(), pinsV = 0;
  /** @param {string} ts */
  const threadTitleOf = (ts) => {
    if (titlesOf !== world.state.threads) { titlesOf = world.state.threads; titles = new Map(titlesOf.map((/** @type {any} */ t) => [t.id, t.title || ""])); }
    return titles.get(ts) || "";
  };
  /** @type {Map<string, any>} */
  const memo = new Map(); // pid → {key, items}
  /** @param {string} pid @returns {any[]} */
  function madeIn(pid) {
    const chat = world.project(pid)?.chatId;
    const rows = servedRows(chat);
    threadTitleOf("");
    const e = served.get(chat);
    const key = rows ? `s|${e.v}|${rows.length}` : `f|${pinsV}`;
    const m = memo.get(pid);
    if (m && m.key === key && m.titles === titles && (rows || m.threads === world.state.threads)) return m.items;
    const items = rows ? madeFromServer(rows, { project: pid, threadTitle: threadTitleOf }).map((x) => ({ ...x, chat })) : madeItems(threadsIn(pid), { pins });
    memo.set(pid, { key, titles, threads: world.state.threads, items });
    return items;
  }
  /** @type {{ parts: any[][], items: any[] }} */
  let allMemo = { parts: [], items: [] };
  /** Every made thing of a project, or of every project (null), newest first. @param {string | null} pid @returns {any[]} */
  function madeOf(pid) {
    if (pid) return madeIn(pid);
    const parts = projectsMade().map((p) => madeIn(p.id));
    if (parts.length === allMemo.parts.length && parts.every((x, i) => x === allMemo.parts[i])) return allMemo.items;
    allMemo = { parts, items: parts.flat().sort((a, b) => b.at - a.at) };
    return allMemo.items;
  }

  /** Pin or unpin: the backend's pin for every device, shown at once and put back if refused; else this browser's. @param {string} key */
  function togglePin(key) {
    const m = madeOf(null).find((x) => x.key === key);
    const on = m ? !m.pinned : !pins.has(key);
    if (m && m.server && m.chat) {
      const e = served.get(m.chat);
      const row = (e?.rows || []).find((/** @type {any} */ r) => r.id === m.id);
      if (row) { row.pinned = on; e.v++; }
      api.pinMade(m.chat, m.id, on).catch((/** @type {any} */ err) => { if (row) { row.pinned = !on; e.v++; } announce(`Couldn't ${on ? "pin" : "unpin"} it: ${err.message}`); schedule(); changed(); });
    } else {
      if (on) pins.add(key); else pins.delete(key);
      pinsV++;
      savePins();
    }
    announce(on ? "Pinned" : "Unpinned");
    changed();
    schedule();
  }

  /** Is any project's Made still paging older rows? */
  const olderLeft = () => projectsMade().some((p) => { const e = served.get(p.chatId); return e && !e.off && e.more && !e.end; });

  return { madeOf, madePending, olderPages, projectsMade, olderLeft, togglePin };
}
