// @ts-check

export { latest } from "./latest.js";

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
