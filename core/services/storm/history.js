// @ts-check
import { client, NEWEST } from "./client.js";
import { mergeRows, pageAfter, canPageOlder, framesShort } from "../../../js/timeline.js";
import { PAGE, OLDER_PAGE } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** Conversations read backwards by seq, a page at a time, and rows looked up by id. @param {Ctx} ctx */
export function installHistory(ctx) {
  const { state, rawThreads, trimmed, framesBefore, emit } = ctx;

  /** The copies of the workspace's messages in a project, for the "Routed to …" receipts. @param {string} project @param {Row[]} rows */
  function noteCopies(project, rows) {
    const ws = ctx.chatIdOf("workspace");
    if (!ws || project === "workspace") return;
    for (const r of rows) {
      const f = r.extra && r.extra.forwarded_from;
      if (!f || f.chat_id !== ws || !f.message_id) continue;
      const list = state.routed[f.message_id] || (state.routed[f.message_id] = []);
      if (!list.some((/** @type {Row} */ x) => x.chat === project)) list.push({ chat: project, messageId: r.id });
    }
  }
  ctx.addRows = (project, rows) => {
    const { list, added } = mergeRows(state.timeline[project] || [], rows);
    state.timeline[project] = list;
    if (added.length) noteCopies(project, added);
    return added;
  };
  ctx.loadTimeline = async (project) => {
    const chat = ctx.chatIdOf(project);
    if (!chat) return;
    const h = state.hist[project];
    if (h && (h.loading || h.loaded)) return;
    state.hist[project] = { loading: true, loaded: false, all: false, error: null, before: null };
    emit();
    try {
      const d = await client.messages(chat, { before_seq: NEWEST, limit: PAGE });
      ctx.addRows(project, d.messages || []);
      state.hist[project] = { loading: false, loaded: true, all: !d.next_before_seq, error: null, before: d.next_before_seq || null };
    } catch (/** @type {any} */ err) {
      state.hist[project] = { loading: false, loaded: false, all: false, error: err.message, before: null };
    }
    emit();
  };
  /** The page just before the oldest we have: each page is fetched exactly once. */
  ctx.loadOlder = async (project) => {
    const chat = ctx.chatIdOf(project);
    const h = state.hist[project];
    if (!chat || !h || h.all || h.loading || !h.before) return;
    h.loading = true;
    emit();
    try {
      const d = await client.messages(chat, { before_seq: h.before, limit: OLDER_PAGE });
      ctx.addRows(project, d.messages || []);
      h.before = d.next_before_seq || null;
      h.all = !h.before;
      h.olderError = null;
    } catch (/** @type {any} */ err) { h.olderError = err.message; }
    h.loading = false;
    emit();
  };
  /** An open thread: its newest page of messages and its session's recent turns, once; older pages come as you scroll up. */
  ctx.loadThread = async (ts) => {
    const r = rawThreads.get(ts);
    if (!r) return;
    const th = state.threadHist[ts] || (state.threadHist[ts] = { loading: false, loaded: false, error: null });
    // its turns were pruned while it was off screen: read them again, as far back as its pages go
    if (th.loaded && r.session_id && trimmed.has(r.session_id)) {
      trimmed.delete(r.session_id);
      const oldest = (state.threadMsgs[ts] || [])[0];
      ctx.loadTurns(r.session_id).then(() => loadOlderTurns(r.session_id, oldest ? oldest.seq : null)).then(ctx.soon);
      return;
    }
    if (th.loading || th.loaded) return;
    th.loading = true;
    ctx.soon();
    try {
      // its notes and the messages relayed into it (hops) land with the page: arriving after it, they moved what you were reading
      const [m] = await Promise.all([
        client.messages(r.chat_id, { thread: ts, before_seq: NEWEST, limit: PAGE }),
        r.session_id ? ctx.loadTurns(r.session_id) : null,
        ctx.hopsOnce(ts),
      ]);
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      state.threadMsgs[ts] = list;
      Object.assign(th, pageAfter(th, m), { error: null });
    } catch (/** @type {any} */ err) { th.error = err.message; }
    th.loading = false;
    ctx.soon();
  };
  /** The thread's page just before the oldest we hold, with its turns' frames, so the page lands once, whole. */
  ctx.loadOlderThread = async (ts) => {
    const r = rawThreads.get(ts);
    const th = state.threadHist[ts];
    if (!r || !canPageOlder(th)) return;
    th.older = true;
    ctx.soon();
    try {
      const m = await client.messages(r.chat_id, { thread: ts, before_seq: th.before, limit: OLDER_PAGE });
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      if (r.session_id) await loadOlderTurns(r.session_id, list.length ? list[0].seq : null);
      state.threadMsgs[ts] = list;
      Object.assign(th, pageAfter(th, m), { olderError: null });
    } catch (/** @type {any} */ err) { th.olderError = err.message; }
    th.older = false;
    ctx.soon();
  };
  /** A session's older stored frames, a page at a time, until they reach `floor` (at most three pages). @param {string} session @param {number | null} floor */
  async function loadOlderTurns(session, floor) {
    for (let i = 0; i < 3 && framesShort(framesBefore.get(session), floor); i++) {
      try {
        const d = await client.events({ session, before_seq: framesBefore.get(session), limit: 500 });
        for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
        framesBefore.set(session, d.next_before_seq ?? null);
      } catch { return; /* the messages still land; their work shows when it can be read */ }
    }
  }
  /** A coordinator's control of a thread, once per stored event, in order. */
  ctx.noteControl = (env, d) => {
    const ts = env.thread_ts || d.thread_ts;
    if (!ts || !d.action) return false;
    const list = state.controls[ts] || (state.controls[ts] = []);
    if (env.seq != null && list.some((/** @type {Row} */ c) => c.seq === env.seq)) return false;
    list.push({ ...d, at: env.ts, seq: env.seq ?? null });
    list.sort((/** @type {Row} */ a, /** @type {Row} */ b) => (a.seq ?? Infinity) - (b.seq ?? Infinity));
    return true;
  };
  // its frames, and the thread's control rows and move, read side by side: a thread's first page waits for both
  ctx.loadTurns = async (session) => {
    const [d, c] = await Promise.all([
      client.events({ session, before_seq: NEWEST, limit: 500 }).catch(() => null), // live frames still arrive
      client.events({ session, kinds: "thread.control,thread.continued", before_seq: NEWEST, limit: 500 }).catch(() => null),
    ]);
    if (d) {
      for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
      framesBefore.set(session, d.next_before_seq ?? null);
    }
    for (const f of (c && c.events) || []) {
      const x = f.data || {};
      if (f.type === "thread.control") ctx.noteControl(f, x);
      else if (f.type === "thread.continued" && (x.from || f.thread_ts) && !state.moves[x.from || f.thread_ts]) state.moves[x.from || f.thread_ts] = { ...x, at: f.ts };
    }
  };

  /** Rows named by id and not loaded: ONE backwards walk per project for all asked at once, pages of 50, newest hint first, at most 6 pages. @type {Set<string>} */
  const sought = new Set();
  /** @type {Map<string, Map<string, number | null>>} */
  const wanted = new Map();
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let findT = 0;
  ctx.clearSought = () => sought.clear();
  ctx.findRows = (project, ids, beforeSeq) => {
    let q = wanted.get(project);
    for (const id of ids) {
      if ((state.timeline[project] || []).some((/** @type {Row} */ r) => r.id === id) || state.found[project]?.has(id)) continue;
      const key = `${project}|${id}@${beforeSeq ?? ""}`;
      if (sought.has(key)) continue;
      sought.add(key);
      if (!q) wanted.set(project, (q = new Map()));
      q.set(id, beforeSeq ?? null);
    }
    if (q && q.size && !findT) findT = setTimeout(walkFound, 0);
  };
  // what it finds goes to state.found, never the visible timeline
  async function walkFound() {
    findT = 0;
    const jobs = [...wanted]; wanted.clear();
    await Promise.all(jobs.map(async ([project, q]) => {
      const chat = ctx.chatIdOf(project);
      if (!chat) return;
      const map = state.found[project] || (state.found[project] = new Map());
      let floor = Infinity; // nothing at or above this seq is left to read
      for (let page = 0; page < 6 && q.size; page++) {
        const top = Math.max(...[...q.values()].map((s) => (s == null ? Infinity : s)));
        const from = Math.min(top === Infinity ? Infinity : top + 1, floor);
        let d;
        try { d = await client.messages(chat, { before_seq: from === Infinity ? NEWEST : from, limit: 50 }); } catch { return; }
        const rows = d.messages || [];
        for (const r of rows) { map.set(r.id, r); q.delete(r.id); }
        if (!rows.length || !d.next_before_seq) break;
        floor = Math.min(...rows.map((/** @type {Row} */ r) => r.seq));
        for (const [id, s] of q) if (s == null || s >= floor) q.set(id, floor - 1);
      }
    }));
    ctx.emitSoon();
  }
}
