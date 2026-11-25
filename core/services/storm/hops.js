// @ts-check
import { client, NEWEST, reportReadFailure } from "./client.js";
import { hopRank, mergeHop } from "../world/hops.js";

/** @typedef {import("./types").Ctx} Ctx */

/** How messages travelled: hops read once per thread or chat, then kept current by the stream; a hop only moves on. @param {Ctx} ctx */
export function installHops(ctx) {
  const { state, rawThreads } = ctx;
  /** @param {string} ts */
  async function loadThreadHops(ts) {
    const { signal } = ctx.reads;
    const r = rawThreads.get(ts);
    if (signal.aborted || !r) return;
    try {
      const d = await client.hops(r.chat_id, { thread: ts, before_seq: NEWEST, limit: 200 }, { signal });
      if (signal.aborted) return;
      for (const h of d.hops || []) ctx.putHop(h, { at: h.created_at });
      ctx.emitSoon();
    } catch (error) { reportReadFailure(error, signal, true); }
  }
  /** A burst of hops is one read. @type {(() => void) | undefined} */
  let hopsT;
  ctx.hopsSoon = (ts) => { hopsT?.(); hopsT = ctx.reads.timeout(() => loadThreadHops(ts), 400); };
  /** A receipt for a hop not known yet is held until the hop arrives, so a cold load never shows a wait that ended. @type {Map<string, string>} */
  const heldMoves = new Map();
  ctx.holdMove = (id, st) => {
    if (hopRank(st) <= hopRank(heldMoves.get(id))) return;
    heldMoves.delete(id); heldMoves.set(id, st);
    if (heldMoves.size > 500) heldMoves.delete(/** @type {string} */ (heldMoves.keys().next().value));
  };
  ctx.putHop = (h, extra) => {
    state.hops.set(h.id, mergeHop(state.hops.get(h.id), h, extra, heldMoves.get(h.id)));
    heldMoves.delete(h.id);
  };
  /** @type {WeakMap<AbortSignal, Set<string>>} */
  const chatReads = new WeakMap();
  /** @type {WeakMap<AbortSignal, Map<string, Promise<void>>>} */
  const threadReads = new WeakMap();
  ctx.hopsOnce = (ts) => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    const reads = threadReads.get(signal) || new Map();
    threadReads.set(signal, reads);
    if (!reads.has(ts)) reads.set(ts, loadThreadHops(ts));
    return reads.get(ts);
  };
  /** A Workspace or project chat's own hops, for "Show hops" on its timeline, read once per chat. */
  ctx.loadChatHops = async (project) => {
    const { signal } = ctx.reads;
    const chat = ctx.chatIdOf(project);
    const hopsRead = chatReads.get(signal) || new Set();
    if (signal.aborted || !chat || hopsRead.has(chat)) return;
    chatReads.set(signal, hopsRead);
    hopsRead.add(chat);
    try {
      const d = await client.hops(chat, { before_seq: NEWEST, limit: 500 }, { signal });
      if (signal.aborted) return;
      for (const h of d.hops || []) ctx.putHop(h, { at: h.created_at });
      ctx.emitSoon();
    } catch { hopsRead.delete(chat); }
  };
}
