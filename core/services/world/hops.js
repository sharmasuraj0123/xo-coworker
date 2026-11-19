// @ts-check
const RANK = /** @type {Record<string, number>} */ ({ sent: 0, delivered: 1, answered: 2 }); // a hop only moves on: a merge keeps the further state, whichever came last
/** @param {string | null | undefined} state */
export const hopRank = (state) => RANK[/** @type {string} */ (state)] ?? -1;
/** The further of two states (a known state beats an unknown one). @param {string | null | undefined} a @param {string | null | undefined} b */
export const furtherState = (a, b) => (hopRank(b) > hopRank(a) ? b : a);
/** `h` over `old` (with `extra` on top), never moving the state back past `old`'s or a `held` receipt's. @param {Record<string, any> | null | undefined} old @param {Record<string, any>} h @param {Record<string, any>} [extra] @param {string | null} [held] */
export function mergeHop(old, h, extra = {}, held = null) {
  const next = { ...(old || {}), ...h, ...extra };
  next.state = furtherState(furtherState(next.state, old && old.state), held);
  return next;
}
