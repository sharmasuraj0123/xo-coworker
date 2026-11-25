// @ts-check
import { client, reportReadFailure } from "./client.js";
import { ApiError } from "../../platform/http.js";
import { currentPools } from "../world/sessions.js";
import { mapLimit } from "./load.js";
import { LOAD_CAP, STATUS_MS, STATUS_RETRY_MS, RUNTIMES_MS } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** The account side: the engine's status and pools, the runtimes and router, paid usage and runtime policies. @param {Ctx} ctx */
export function installAccount(ctx) {
  const { state, emit, scope } = ctx;
  const { signal } = scope;
  /** @type {(() => void) | undefined} */
  let statusT;
  /** @type {(() => void) | undefined} */
  let runtimesT;
  ctx.loadStatus = async () => {
    if (signal.aborted) return;
    statusT?.();
    const sig = ctx.poolsSig();
    try {
      const status = await client.status({ signal });
      if (signal.aborted) return;
      state.status = status;
      state.statusError = null; state.statusCode = null;
      const fresh = (state.status.pools || []).some((/** @type {Row} */ p) => !(p.id in state.pools));
      for (const p of state.status.pools || []) state.pools[p.id] = { ...(state.pools[p.id] || {}), pool: p.id, state: p.state, resets_at: p.resets_at, reason: p.reason || null };
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
    if (ctx.poolsSig() !== sig) ctx.commit();
    emit();
    statusT = scope.timeout(ctx.loadStatus, state.statusError ? STATUS_RETRY_MS : STATUS_MS);
  };
  /** @type {Promise<void> | null} */
  let runtimesBusy = null;
  // what a held thread waits on is its pool: a pool that changes rebuilds the threads, not only the composer
  ctx.poolsSig = () => Object.entries(state.pools).map(([id, p]) => `${id}|${p.state}|${p.resets_at}|${p.reason}`).sort().join(",");
  const poolHeld = () => currentPools(state.pools, state.runtimes).some((/** @type {Row} */ p) => p.state === "closed" || p.state === "paid");
  ctx.refreshRuntimes = () => {
    if (!runtimesBusy) runtimesBusy = ctx.loadRuntimes().finally(() => { runtimesBusy = null; });
    return runtimesBusy;
  };
  ctx.loadRuntimes = async () => {
    if (signal.aborted) return;
    runtimesT?.();
    try {
      const { runtimes } = await client.runtimes({ signal });
      if (!signal.aborted) state.runtimes = runtimes || [];
    } catch (error) { reportReadFailure(error, signal, true); }
    if (signal.aborted) return;
    try {
      const router = await client.router({ signal });
      if (!signal.aborted) state.router = router;
    } catch (error) { reportReadFailure(error, signal, true); }
    if (signal.aborted) return;
    emit();
    runtimesT = scope.timeout(ctx.loadRuntimes, RUNTIMES_MS);
  };

  /** @type {Promise<void> | null} */
  let paidBusy = null;
  /** Paid usage: the advisory's facts and the founder's modes. A server without them leaves what was read. */
  ctx.loadPaid = () => {
    if (signal.aborted) return Promise.resolve();
    if (paidBusy) return paidBusy;
    paidBusy = (async () => {
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
      if (ctx.poolsSig() !== sig || usageOpen) ctx.commit();
      emit();
    })().finally(() => { paidBusy = null; });
    return paidBusy;
  };

  ctx.loadSpacePolicy = async () => {
    if (signal.aborted) return;
    try {
      const policy = await client.runtimePolicy({ signal });
      if (!signal.aborted) state.policy = policy;
    } catch (error) { reportReadFailure(error, signal, true); }
  };
  /** @type {Map<string, Promise<void>>} */
  const policyReads = new Map();
  ctx.loadChatPolicy = (chat, fresh = false) => {
    if (signal.aborted) return null;
    if (!chat || (!fresh && policyReads.has(chat))) return chat ? policyReads.get(chat) || null : null;
    const read = client.chatRuntimePolicy(chat, { signal }).then((p) => {
      if (signal.aborted) return;
      state.chatPolicy[chat] = p; ctx.soon();
    }, (error) => reportReadFailure(error, signal, true));
    policyReads.set(chat, read);
    return read;
  };
  ctx.loadPolicies = async () => {
    await ctx.loadSpacePolicy();
    if (signal.aborted || !state.policy) return;
    await mapLimit(state.projects.filter((p) => p.kind === "project" && p.chatId), LOAD_CAP, async (p) => ctx.loadChatPolicy(p.chatId, true));
    if (!signal.aborted) emit();
  };
}
