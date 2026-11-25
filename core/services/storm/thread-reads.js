// @ts-check
import { client, reportReadFailure } from "./client.js";
import { createLru } from "../../platform/cache.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

export function createThreadRecords() {
  /** @type {Map<string, Row>} */
  const table = new Map();
  /** @type {ReadonlyMap<string, Row>} */
  const rows = table;
  /** @type {WeakMap<Row, { latest: number, fields: Map<string, number> }>} */
  const versions = new WeakMap();
  /** @type {Map<string, number>} */
  const removed = new Map();
  /** @type {Set<number>} */
  const active = new Set();
  let clock = 0;

  return {
    rows,
    /** @param {string} id @param {Row} changes */
    write(id, changes, order = ++clock) {
      if ((removed.get(id) ?? 0) > order) return rows.get(id);
      const old = rows.get(id);
      const prev = old && versions.get(old);
      const fields = prev?.fields ?? new Map();
      const row = { ...old };
      for (const [field, value] of Object.entries(changes)) {
        if ((fields.get(field) ?? 0) > order) continue;
        fields.set(field, order);
        row[field] = value;
      }
      versions.set(row, { latest: Math.max(prev?.latest ?? 0, order), fields });
      table.set(id, row);
      removed.delete(id);
      return row;
    },
    /** @param {string} id */
    remove(id, order = ++clock) {
      table.delete(id);
      if (active.size) removed.set(id, order);
    },
    /** @param {string} id @param {number} order */
    acceptsRemoval(id, order) {
      const row = rows.get(id);
      return (row ? versions.get(row)?.latest ?? 0 : removed.get(id) ?? 0) <= order;
    },
    /** @template T @param {(order: number) => Promise<T>} read */
    async read(read) {
      const order = ++clock;
      active.add(order);
      try { return await read(order); }
      finally {
        active.delete(order);
        const oldest = active.values().next().value ?? Infinity;
        for (const [id, removedAt] of removed) if (removedAt < oldest) removed.delete(id);
      }
    },
  };
}

/** @param {Ctx} ctx */
export function installThreadReads(ctx) {
  const { rawThreads, threadRecords } = ctx;
  /** @type {WeakMap<AbortSignal, Map<string, number>>} */
  const listOrders = new WeakMap();

  /** @param {AbortSignal} signal @param {string} chatId @param {number} order */
  const currentListing = (signal, chatId, order) => (listOrders.get(signal)?.get(chatId) ?? 0) <= order;

  /** @param {string} ts @param {Row} data @param {number} order @param {import("./types").Sent} sent */
  function mergeThread(ts, data, order, sent) {
    const now = Date.now();
    threadRecords.write(ts, { ...data, _at: now, _readAt: now, ...ctx.sessRead(data, sent) }, order);
  }

  ctx.loadThreads = (p) => threadRecords.read(async (order) => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    const sent = ctx.sentAt();
    try {
      const { threads } = await client.threads(p.chatId, { signal });
      if (signal.aborted || !currentListing(signal, p.chatId, order)) return;
      const listings = listOrders.get(signal) || new Map();
      listOrders.set(signal, listings);
      listings.set(p.chatId, order);
      const seen = new Set();
      for (const r of threads || []) { seen.add(r.ts); mergeThread(r.ts, r, order, sent); }
      for (const [ts, r] of rawThreads) {
        if (r.chat_id === p.chatId && !seen.has(ts) && threadRecords.acceptsRemoval(ts, order)) threadRecords.remove(ts, order);
      }
    } catch (error) { reportReadFailure(error, signal, true); }
  });
  /** @type {WeakMap<AbortSignal, Set<string>>} */
  const threadReads = new WeakMap();
  ctx.refetchThread = (chatId, ts) => threadRecords.read(async (order) => {
    const { signal } = ctx.reads;
    if (signal.aborted || !chatId) return;
    const refetchBusy = threadReads.get(signal) || new Set();
    if (refetchBusy.has(ts)) return;
    threadReads.set(signal, refetchBusy);
    refetchBusy.add(ts);
    const sent = ctx.sentAt();
    try {
      const x = await client.thread(chatId, ts, { signal });
      if (signal.aborted || !currentListing(signal, chatId, order)) return;
      mergeThread(ts, x, order, sent);
      ctx.soon();
    } catch (error) { reportReadFailure(error, signal, true); }
    finally { refetchBusy.delete(ts); }
  });
  /** @type {WeakMap<AbortSignal, ReturnType<typeof createLru<string, true>>>} */
  const sessionsByCycle = new WeakMap();
  ctx.fillSession = (chatId, ts) => threadRecords.read(async (order) => {
    const { signal } = ctx.reads;
    if (signal.aborted || !chatId) return;
    const asked = sessionsByCycle.get(signal) || createLru({ max: 512 });
    if (asked.has(ts)) return;
    sessionsByCycle.set(signal, asked);
    asked.set(ts, true);
    const sent = ctx.sentAt();
    try {
      const x = await client.thread(chatId, ts, { signal }), r = rawThreads.get(ts);
      if (signal.aborted || !currentListing(signal, chatId, order)) { asked.delete(ts); return; }
      if (r && x && !r.session) {
        threadRecords.write(ts, { session: x.session || null, pin: x.pin || r.pin || {}, ...ctx.sessRead(x, sent) }, order);
        ctx.soon();
      }
    } catch (error) { asked.delete(ts); reportReadFailure(error, signal, true); }
  });
}
