// @ts-check
import { client, reportReadFailure } from "./client.js";
import { ApiError } from "../../platform/http.js";
import { latest, once } from "../../platform/pending.js";
import { createLru } from "../../platform/cache.js";
import { currentPools } from "../world/sessions.js";
import { mapLimit } from "./load.js";
import { withPools } from "../runtimes.js";
import { LOAD_CAP, STATUS_MS, STATUS_RETRY_MS, RUNTIMES_MS } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx */

/** @param {Ctx} ctx @param {(signal: AbortSignal) => Promise<void>} read @param {() => number} period */
function poll(ctx, read, period) {
  /** @type {WeakMap<AbortSignal, symbol>} */
  const keys = new WeakMap();
  /** @type {(() => void) | undefined} */
  let timer;
  const load = async () => {
    const cycle = ctx.reads;
    const { signal } = cycle;
    if (signal.aborted) return;
    const key = keys.get(signal) ?? Symbol();
    keys.set(signal, key);
    await once(key, async () => {
      timer?.();
      const next = cycle.effect(() => () => {
        if (!ctx.scope.signal.aborted) timer = ctx.scope.timeout(load, period());
      });
      try { await read(signal); }
      finally { next(); }
    });
  };
  return load;
}

/** The account side: the engine's status and pools, the runtimes and router, paid usage and runtime policies. @param {Ctx} ctx */
export function installAccount(ctx) {
  const { state, emit } = ctx;
  ctx.loadStatus = poll(ctx, async (signal) => {
    const sig = ctx.poolsSig();
    try {
      const status = await client.status({ signal });
      if (signal.aborted) return;
      state.status = status;
      state.statusError = null; state.statusCode = null;
      const fresh = (state.status.pools || []).some((p) => !(p.id in state.pools));
      for (const p of state.status.pools || []) state.pools[p.id] = { ...(state.pools[p.id] || {}), pool: p.id, state: p.state, resets_at: p.resets_at, reason: p.reason || null, ...(p.windows ? { windows: p.windows } : {}) };
      // a new pool is a re-login, and while something holds work back the account may have changed under it: read the runtimes now
      if (ctx.poolsSeen && (fresh || poolHeld())) ctx.refreshRuntimes();
      ctx.poolsSeen = true;
      ctx.loadPaid();
    } catch (err) {
      if (signal.aborted) return;
      state.statusError = err instanceof Error ? err.message : String(err);
      state.statusCode = err instanceof ApiError ? err.code : null;
      reportReadFailure(err, signal);
    }
    ctx.joinPools();
    if (ctx.poolsSig() !== sig) ctx.commit();
    emit();
  }, () => state.statusError ? STATUS_RETRY_MS : STATUS_MS);
  // what a held thread waits on is its pool: a pool that changes rebuilds the threads, not only the composer
  ctx.joinPools = () => { if (ctx.runtimesRead) state.runtimes = withPools(ctx.runtimesRead, state.pools); };
  ctx.poolsSig = () => Object.entries(state.pools).map(([id, p]) => `${id}|${p.state}|${p.resets_at}|${p.reason}`).sort().join(",");
  const poolHeld = () => currentPools(state.pools, state.runtimes).some((p) => p.state === "closed" || p.state === "paid");
  ctx.loadRuntimes = ctx.refreshRuntimes = poll(ctx, async (signal) => {
    try {
      const { runtimes } = await client.runtimes({ signal });
      if (!signal.aborted) { ctx.runtimesRead = runtimes || []; ctx.joinPools(); }
    } catch (error) { reportReadFailure(error, signal, true); }
    if (signal.aborted) return;
    try {
      const router = await client.router({ signal });
      if (!signal.aborted) state.router = router;
    } catch (error) { reportReadFailure(error, signal, true); }
    if (!signal.aborted) emit();
  }, () => RUNTIMES_MS);

  /** @type {{ signal: AbortSignal, promise: Promise<void> } | null} */
  let paidBusy = null;
  /** Paid usage: the advisory's facts and the founder's modes. A server without them leaves what was read. */
  ctx.loadPaid = () => {
    const { signal } = ctx.reads;
    if (signal.aborted) return Promise.resolve();
    if (paidBusy?.signal === signal) return paidBusy.promise;
    const promise = (async () => {
      let changed = false;
      const sig = ctx.poolsSig();
      try {
        const advisory = await client.advisory({ signal });
        if (signal.aborted) return;
        state.advisory = advisory; changed = true;
      } catch (error) { reportReadFailure(error, signal, true); }
      if (signal.aborted) return;
      try {
        const r = await client.intents({ signal });
        if (signal.aborted) return;
        state.paid = r.intents || []; state.paidPools = r.pools || []; state.paidOk = true;
        // what XO says each pool is doing, as of now: a change of mode shows in the composer's line at once
        for (const p of state.paidPools) {
          if (p && p.pool && state.pools[p.pool]) {
            state.pools[p.pool] = { ...state.pools[p.pool], state: p.state, resets_at: p.resets_at, reason: p.reason || null };
          }
        }
        changed = true;
      } catch (error) { reportReadFailure(error, signal, true); }
      if (!changed || signal.aborted) return;
      const usageOpen = [...state.review.values()].some((it) => it.state === "open" && it.kind === "usage");
      if (ctx.poolsSig() !== sig) ctx.joinPools();
      if (ctx.poolsSig() !== sig || usageOpen) ctx.commit();
      emit();
    })().finally(() => { if (paidBusy?.signal === signal) paidBusy = null; });
    paidBusy = { signal, promise };
    return promise;
  };

  ctx.loadSpacePolicy = async () => {
    const { signal } = ctx.reads;
    if (signal.aborted) return;
    try {
      const policy = await client.runtimePolicy({ signal });
      if (!signal.aborted) state.policy = policy;
    } catch (error) { reportReadFailure(error, signal, true); }
  };
  /** @type {WeakMap<AbortSignal, ReturnType<typeof createLru<string, { key: symbol, promise: Promise<void> }>>>} */
  const readsByCycle = new WeakMap();
  ctx.loadChatPolicy = (chat, fresh = false) => {
    const { signal } = ctx.reads;
    if (signal.aborted || !chat) return null;
    const policyReads = readsByCycle.get(signal) || createLru({ max: 512 });
    readsByCycle.set(signal, policyReads);
    const previous = policyReads.get(chat);
    if (previous && !fresh) return previous.promise;
    const key = previous?.key ?? Symbol();
    const promise = latest(key, (readSignal) => client.chatRuntimePolicy(chat, { signal: readSignal }), {
      signal,
      commit(p) {
        if (policyReads.get(chat)?.promise !== promise) return;
        state.chatPolicy[chat] = p;
        ctx.soon();
      },
    }).then(() => {}, (error) => {
      if (policyReads.get(chat)?.promise !== promise) return;
      policyReads.delete(chat);
      reportReadFailure(error, signal, true);
    });
    policyReads.set(chat, { key, promise });
    return promise;
  };
  ctx.loadPolicies = async () => {
    const { signal } = ctx.reads;
    await ctx.loadSpacePolicy();
    if (signal.aborted || !state.policy) return;
    const projects = state.projects.filter((p) => p.kind === "project" && p.chatId);
    await mapLimit(projects, LOAD_CAP, async (p) => ctx.loadChatPolicy(p.chatId, true), signal);
    if (!signal.aborted) emit();
  };
}
