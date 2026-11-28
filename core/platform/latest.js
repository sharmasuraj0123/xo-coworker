// @ts-check

/** @type {Map<unknown, AbortController>} */
const latestByKey = new Map();

/** Retire a read when its data is superseded locally. @param {unknown} key */
export function cancelLatest(key) {
  latestByKey.get(key)?.abort();
}

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
