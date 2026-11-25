// @ts-check
import { client, NEWEST, reportReadFailure } from "./client.js";
import { createLru } from "../../platform/cache.js";
import { mergeRows, pageAfter, canPageOlder, framesShort } from "../world/rows.js";
import { PAGE, OLDER_PAGE } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */
const LOOKUP_RETRY_MS = 1000;

/** @param {Ctx["reads"]} cycle @param {Row} page @param {"loading" | "older"} flag */
function loading(cycle, page, flag) {
  page[flag] = true;
  return cycle.effect(() => () => { page[flag] = false; });
}

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
    const cycle = ctx.reads;
    const { signal } = cycle;
    const chat = ctx.chatIdOf(project);
    if (signal.aborted || !chat) return;
    const h = state.hist[project];
    if (h && (h.loading || h.loaded)) return;
    const page = state.hist[project] = { loading: false, loaded: false, all: false, error: null, before: null };
    const stopLoading = loading(cycle, page, "loading");
    emit();
    try {
      const d = await client.messages(chat, { before_seq: NEWEST, limit: PAGE }, { signal });
      if (signal.aborted) return;
      ctx.addRows(project, d.messages || []);
      state.hist[project] = { loading: false, loaded: true, all: !d.next_before_seq, error: null, before: d.next_before_seq || null };
    } catch (err) {
      if (signal.aborted) return;
      state.hist[project] = { loading: false, loaded: false, all: false, error: err instanceof Error ? err.message : null, before: null };
    } finally { stopLoading(); }
    emit();
  };
  /** The page just before the oldest we have: each page is fetched exactly once. */
  ctx.loadOlder = async (project) => {
    const cycle = ctx.reads;
    const { signal } = cycle;
    const chat = ctx.chatIdOf(project);
    const h = state.hist[project];
    if (signal.aborted || !chat || !h || h.all || h.loading || !h.before) return;
    const stopLoading = loading(cycle, h, "loading");
    emit();
    try {
      const d = await client.messages(chat, { before_seq: h.before, limit: OLDER_PAGE }, { signal });
      if (signal.aborted) return;
      ctx.addRows(project, d.messages || []);
      h.before = d.next_before_seq || null;
      h.all = !h.before;
      h.olderError = null;
    } catch (err) { if (signal.aborted) return; h.olderError = err instanceof Error ? err.message : String(err); }
    finally { stopLoading(); }
    emit();
  };
  /** An open thread: its newest page of messages and its session's recent turns, once; older pages come as you scroll up. */
  ctx.loadThread = async (ts) => {
    const cycle = ctx.reads;
    const { signal } = cycle;
    const r = rawThreads.get(ts);
    if (signal.aborted || !r) return;
    const th = state.threadHist[ts] || (state.threadHist[ts] = { loading: false, loaded: false, error: null });
    // its turns were pruned while it was off screen: read them again, as far back as its pages go
    if (th.loaded && r.session_id && trimmed.has(r.session_id)) {
      trimmed.delete(r.session_id);
      const oldest = (state.threadMsgs[ts] || [])[0];
      ctx.loadTurns(r.session_id).then(() => loadOlderTurns(r.session_id, oldest ? oldest.seq : null, signal))
        .then(() => { if (!signal.aborted) ctx.soon(); });
      return;
    }
    if (th.loading || th.loaded) return;
    const stopLoading = loading(cycle, th, "loading");
    ctx.soon();
    try {
      // its notes and the messages relayed into it (hops) land with the page: arriving after it, they moved what you were reading
      const [m] = await Promise.all([
        client.messages(r.chat_id, { thread: ts, before_seq: NEWEST, limit: PAGE }, { signal }),
        r.session_id ? ctx.loadTurns(r.session_id) : null,
        ctx.hopsOnce(ts),
      ]);
      if (signal.aborted) return;
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      state.threadMsgs[ts] = list;
      Object.assign(th, pageAfter(th, m), { error: null });
    } catch (err) { if (signal.aborted) return; th.error = err instanceof Error ? err.message : String(err); }
    finally { stopLoading(); }
    ctx.soon();
  };
  /** The thread's page just before the oldest we hold, with its turns' frames, so the page lands once, whole. */
  ctx.loadOlderThread = async (ts) => {
    const cycle = ctx.reads;
    const { signal } = cycle;
    const r = rawThreads.get(ts);
    const th = state.threadHist[ts];
    if (signal.aborted || !r || !th || !canPageOlder(th)) return;
    const stopLoading = loading(cycle, th, "older");
    const beforeRead = new Map((state.threadMsgs[ts] || []).map((row) => [row.id, row]));
    ctx.soon();
    try {
      const m = await client.messages(r.chat_id, { thread: ts, before_seq: th.before, limit: OLDER_PAGE }, { signal });
      if (signal.aborted) return;
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      if (r.session_id) await loadOlderTurns(r.session_id, list.length ? list[0].seq : null, signal);
      if (signal.aborted) return;
      const current = state.threadMsgs[ts] || [];
      const newer = new Set(current.filter((row) => beforeRead.get(row.id) !== row).map((row) => row.id));
      state.threadMsgs[ts] = mergeRows(current, m.messages.filter((row) => !newer.has(row.id))).list;
      Object.assign(th, pageAfter(th, m), { olderError: null });
    } catch (err) { if (signal.aborted) return; th.olderError = err instanceof Error ? err.message : String(err); }
    finally { stopLoading(); }
    ctx.soon();
  };
  /** @param {string} session @param {number | null} floor @param {AbortSignal} signal */
  async function loadOlderTurns(session, floor, signal) {
    for (let i = 0; i < 3 && !signal.aborted && framesShort(framesBefore.get(session), floor); i++) {
      try {
        const d = await client.events({ session, before_seq: framesBefore.get(session), limit: 500 }, { signal });
        if (signal.aborted) return;
        for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
        framesBefore.set(session, d.next_before_seq ?? null);
      } catch (error) { reportReadFailure(error, signal, true); return; }
    }
  }
  /** A coordinator's control of a thread, once per stored event, in order. */
  ctx.noteControl = (env, d) => {
    const ts = env.thread_ts || d.thread_ts;
    if (!ts || !d.action) return false;
    const list = state.controls[ts] || (state.controls[ts] = []);
    if (env.seq != null && list.some((/** @type {Row} */ c) => c.seq === env.seq)) return false;
    list.push({ ...d, action: d.action, at: env.ts, seq: env.seq ?? null });
    list.sort((/** @type {Row} */ a, /** @type {Row} */ b) => (a.seq ?? Infinity) - (b.seq ?? Infinity));
    return true;
  };
  ctx.loadTurns = async (session) => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    const [d, c] = await Promise.all([
      client.events({ session, before_seq: NEWEST, limit: 500 }, { signal })
        .catch((error) => { reportReadFailure(error, signal, true); return null; }),
      client.events({ session, kinds: "thread.control,thread.continued", before_seq: NEWEST, limit: 500 }, { signal })
        .catch((error) => { reportReadFailure(error, signal, true); return null; }),
    ]);
    if (signal.aborted) return;
    if (d) {
      for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
      framesBefore.set(session, d.next_before_seq ?? null);
    }
    for (const f of (c && c.events) || []) {
      const x = f.data || {};
      if (f.type === "thread.control") ctx.noteControl(f, x);
      else if (f.type === "thread.continued" && f.ts) {
        const from = typeof x.from === "string" && x.from ? x.from : f.thread_ts;
        if (from && !state.moves[from]) state.moves[from] = { ...x, at: f.ts };
      }
    }
  };

  /** @type {ReturnType<typeof createLru<string, number>>} */
  const sought = createLru({ max: 512 });
  /** @type {Map<string, Map<string, { key: string, before: number | null }>>} */
  const wanted = new Map();
  /** @type {(() => void) | null} */
  let findT = null;
  ctx.clearSought = () => { sought.clear(); wanted.clear(); findT?.(); findT = null; };
  ctx.findRows = (project, ids, beforeSeq) => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    let q = wanted.get(project);
    for (const id of ids) {
      if ((state.timeline[project] || []).some((/** @type {Row} */ r) => r.id === id) || state.found[project]?.has(id)) continue;
      const key = `${project}|${id}@${beforeSeq ?? ""}`;
      if (q?.has(id) || (sought.get(key) ?? 0) > Date.now()) continue;
      sought.set(key, Infinity);
      if (!q) wanted.set(project, (q = new Map()));
      q.set(id, { key, before: beforeSeq ?? null });
    }
    if (q && q.size && !findT) findT = ctx.reads.timeout(() => walkFound(signal), 0);
  };
  /** @param {AbortSignal} signal */
  async function walkFound(signal) {
    findT = null;
    const jobs = [...wanted]; wanted.clear();
    await Promise.all(jobs.map(async ([project, q]) => {
      const chat = ctx.chatIdOf(project);
      if (!chat) return;
      const map = state.found[project] || (state.found[project] = new Map());
      let floor = Infinity; // nothing at or above this seq is left to read
      for (let page = 0; page < 6 && q.size; page++) {
        const top = Math.max(...[...q.values()].map(({ before }) => before ?? Infinity));
        const from = Math.min(top === Infinity ? Infinity : top + 1, floor);
        let d;
        try {
          d = await client.messages(chat, { before_seq: from === Infinity ? NEWEST : from, limit: 50 }, { signal });
        } catch (error) {
          if (signal.aborted) return;
          for (const { key } of q.values()) sought.set(key, Date.now() + LOOKUP_RETRY_MS);
          reportReadFailure(error, signal);
          return;
        }
        if (signal.aborted) return;
        const rows = d.messages || [];
        for (const r of rows) { map.set(r.id, r); q.delete(r.id); }
        if (!rows.length || !d.next_before_seq) break;
        floor = Math.min(...rows.map((/** @type {Row} */ r) => r.seq));
        for (const entry of q.values()) if (entry.before == null || entry.before >= floor) entry.before = floor - 1;
      }
    }));
    if (!signal.aborted) ctx.emitSoon();
  }
}
