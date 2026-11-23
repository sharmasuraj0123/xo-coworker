// @ts-check
import { client } from "./client.js";
import { currentPools } from "../world/sessions.js";
import { mapLimit } from "./load.js";
import { LOAD_CAP, STATUS_MS, STATUS_RETRY_MS, RUNTIMES_MS } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Row} Row */

/** The account side: the engine's status and pools, the runtimes and router, paid usage and runtime policies. @param {Ctx} ctx */
export function installAccount(ctx) {
  const { state, emit } = ctx;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let statusT;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let runtimesT;
  ctx.loadStatus = async () => {
    clearTimeout(statusT);
    const sig = ctx.poolsSig();
    try {
      state.status = await client.status();
      state.statusError = null; state.statusCode = null;
      const fresh = (state.status.pools || []).some((/** @type {Row} */ p) => !(p.id in state.pools));
      for (const p of state.status.pools || []) state.pools[p.id] = { ...(state.pools[p.id] || {}), pool: p.id, state: p.state, resets_at: p.resets_at, reason: p.reason || null };
      // a new pool is a re-login, and while something holds work back the account may have changed under it: read the runtimes now
      if (ctx.poolsSeen && (fresh || poolHeld())) ctx.refreshRuntimes();
      ctx.poolsSeen = true;
      ctx.loadPaid();
    } catch (/** @type {any} */ err) {
      state.statusError = err.message; state.statusCode = err.code;
    }
    if (ctx.poolsSig() !== sig) ctx.commit();
    emit();
    statusT = setTimeout(ctx.loadStatus, state.statusError ? STATUS_RETRY_MS : STATUS_MS);
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
    clearTimeout(runtimesT);
    try { state.runtimes = (await client.runtimes()).runtimes || []; } catch { /* keep what we had */ }
    try { state.router = await client.router(); } catch { /* keep what we had */ }
    emit();
    runtimesT = setTimeout(ctx.loadRuntimes, RUNTIMES_MS);
  };

  /** @type {Promise<void> | null} */
  let paidBusy = null;
  /** Paid usage: the advisory's facts and the founder's modes. A server without them leaves what was read. */
  ctx.loadPaid = () => {
    if (paidBusy) return paidBusy;
    paidBusy = (async () => {
      let changed = false;
      const sig = ctx.poolsSig();
      try { state.advisory = await client.advisory(); changed = true; } catch { /* keep what we had */ }
      try { const r = await client.intents(); state.paid = r.intents || []; state.paidPools = r.pools || []; state.paidOk = true;
        // what XO says each pool is doing, as of now: a change of mode shows in the composer's line at once
        for (const p of state.paidPools) if (p && p.pool && state.pools[p.pool]) state.pools[p.pool] = { ...state.pools[p.pool], state: p.state, resets_at: p.resets_at, reason: p.reason || null }; changed = true; } catch { /* keep what we had */ }
      if (changed) { if (ctx.poolsSig() !== sig || [...state.review.values()].some((it) => it.state === "open" && it.kind === "usage")) ctx.commit(); emit(); }
    })().finally(() => { paidBusy = null; });
    return paidBusy;
  };

  ctx.loadSpacePolicy = async () => {
    try { state.policy = await client.runtimePolicy(); } catch { /* none on this backend */ }
  };
  /** @type {Map<string, Promise<void>>} */
  const policyReads = new Map();
  ctx.loadChatPolicy = (chat, fresh = false) => {
    if (!chat || (!fresh && policyReads.has(chat))) return chat ? policyReads.get(chat) || null : null;
    const read = client.chatRuntimePolicy(chat).then((p) => { state.chatPolicy[chat] = p; ctx.soon(); }, () => { /* the Space's applies */ });
    policyReads.set(chat, read);
    return read;
  };
  ctx.loadPolicies = async () => {
    await ctx.loadSpacePolicy();
    if (!state.policy) return;
    await mapLimit(state.projects.filter((p) => p.kind === "project" && p.chatId), LOAD_CAP, async (p) => ctx.loadChatPolicy(p.chatId, true));
    emit();
  };

  ctx.stopTimers = () => { clearTimeout(statusT); clearTimeout(runtimesT); };
}
