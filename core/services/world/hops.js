// @ts-check
/** @import { HopRow, Row } from "../storm/types.d.ts" */
const RANK = new Map([["sent", 0], ["delivered", 1], ["answered", 2]]);
/** @param {string | null | undefined} state */
export const hopRank = (state) => state == null ? -1 : RANK.get(state) ?? -1;
/** The further of two states (a known state beats an unknown one). @param {string | null | undefined} a @param {string | null | undefined} b */
export const furtherState = (a, b) => (hopRank(b) > hopRank(a) ? b : a);
/** @param {HopRow | null | undefined} old @param {HopRow} h @param {Row} [extra] @param {string | null} [held] */
export function mergeHop(old, h, extra = {}, held = null) {
  const next = { ...old, ...h, ...extra };
  return Object.assign(next, { state: furtherState(furtherState(next.state, old && old.state), held) });
}
