// @ts-check

/** @template T @typedef {{ ok: true, value: T } | { ok: false, error: unknown }} Result */

/** @param {AbortSignal} signal */
export function createDockRequests(signal) {
  const active = () => !signal.aborted;
  /** @template T @param {() => T} effect */
  const publish = (effect) => active() ? effect() : undefined;

  /** @template T, U @param {() => Promise<T>} work @param {(result: Result<T>) => U} effect */
  async function settle(work, effect) {
    if (!active()) return;
    /** @type {Result<T>} */
    let result;
    try {
      result = { ok: true, value: await work() };
    } catch (error) {
      result = { ok: false, error };
    }
    return publish(() => effect(result));
  }

  /** @template T, U @param {(signal: AbortSignal) => Promise<T>} work @param {(result: Result<T>) => U} effect */
  const read = (work, effect) => settle(() => work(signal), effect);
  return { read, write: settle, active, publish };
}
