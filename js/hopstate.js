// A hop only moves on: sent → delivered → answered, never back (the server's rows.set_hop_state). The
// stream and a history read can arrive in either order, so a merge keeps the further state: a read that
// left before a receipt can't put the receipt back, and a receipt held before its hop was known still counts.
const RANK = { sent: 0, delivered: 1, answered: 2 };
export const hopRank = (state) => RANK[state] ?? -1;
/** The further of two states (a known state beats an unknown one). */
export const furtherState = (a, b) => (hopRank(b) > hopRank(a) ? b : a);
/** `h` over `old` (with `extra` on top), never moving the state back past `old`'s or a `held` receipt's. */
export function mergeHop(old, h, extra = {}, held = null) {
  const next = { ...(old || {}), ...h, ...extra };
  next.state = furtherState(furtherState(next.state, old && old.state), held);
  return next;
}
