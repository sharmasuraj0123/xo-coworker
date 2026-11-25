// @ts-check

/** @type {WeakMap<HTMLElement, import("./card-events-types.d.ts").CardState>} */
const cards = new WeakMap();

/** @param {HTMLElement} frame */
export function cardState(frame) {
  let state = cards.get(frame);
  if (!state) { state = {}; cards.set(frame, state); }
  return state;
}
