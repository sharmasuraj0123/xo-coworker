// @ts-check

// A control that starts a request answers once until it settles: a second press joins the first request.

/** @type {Map<unknown, Promise<any>>} */
const inflight = new Map();
/** For the redraw: the control drawn while its request is out says so. @param {unknown} key */
export const isPending = (key) => inflight.has(key);
/** aria-disabled, not disabled: the control keeps focus and its Tab stop while it waits. @param {unknown} key */
export const busyAttrs = (key) => (inflight.has(key) ? ' aria-busy="true" aria-disabled="true"' : "");
/** Runs work() unless the key is in flight, else returns that same promise; the key frees when it settles. @template T @param {unknown} key @param {() => T | Promise<T>} work @returns {Promise<T>} */
export function once(key, work) {
  if (inflight.has(key)) return /** @type {Promise<T>} */ (inflight.get(key));
  const p = Promise.resolve().then(work).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

/** @type {Map<unknown, AbortController>} */
const latestByKey = new Map();

/** Commit runs synchronously while this read still owns the key. @template T @param {unknown} key @param {(signal: AbortSignal) => T | Promise<T>} work @param {{ signal?: AbortSignal, commit?: (value: T) => void }} [options] @returns {Promise<T>} */
export async function latest(key, work, { signal: parent, commit } = {}) {
  parent?.throwIfAborted();
  const controller = new AbortController();
  const signal = parent ? AbortSignal.any([parent, controller.signal]) : controller.signal;
  const previous = latestByKey.get(key);
  latestByKey.set(key, controller);
  previous?.abort();

  let unlisten = () => {};
  try {
    signal.throwIfAborted();
    const cancelled = new Promise((_, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      unlisten = () => signal.removeEventListener("abort", abort);
    });
    const result = await Promise.race([Promise.resolve().then(() => {
      signal.throwIfAborted();
      return work(signal);
    }), cancelled]);
    signal.throwIfAborted();
    commit?.(result);
    return result;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    unlisten();
    if (latestByKey.get(key) === controller) latestByKey.delete(key);
  }
}
