// @ts-check

/** @template T @typedef {{ ok: true, value: T } | { ok: false, error: unknown }} Result */

/** @param {AbortSignal} signal */
export function createDockRequests(signal) {
  const active = (intent = signal) => !signal.aborted && !intent.aborted;
  /** @template T @param {() => T} effect */
  const publish = (effect) => active() ? effect() : undefined;

  /** @template T, U @param {() => Promise<T>} work @param {(result: Result<T>) => U} effect */
  async function settle(work, effect, intent = signal) {
    if (!active(intent)) return;
    /** @type {Result<T>} */
    let result;
    try {
      result = { ok: true, value: await work() };
    } catch (error) {
      result = { ok: false, error };
    }
    return active(intent) ? effect(result) : undefined;
  }

  /** @template T, U @param {(signal: AbortSignal) => Promise<T>} work @param {(result: Result<T>) => U} effect */
  const read = (work, effect, intent = signal) =>
    settle(() => work(intent === signal ? signal : AbortSignal.any([signal, intent])), effect, intent);
  return { read, write: settle, active, publish };
}
