// @ts-check

/** @param {{ subscribe: (fn: () => void) => () => void }} world @param {() => boolean} test @param {() => void} fn */
export function whenWorld(world, test, fn) {
  /** @type {(() => void) | null} */
  let off = null;
  let met = false;
  const check = () => { if (met || !test()) return; met = true; off?.(); fn(); };
  off = world.subscribe(check);
  if (met) off();
}
