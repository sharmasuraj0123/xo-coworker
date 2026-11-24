// @ts-check

/** @param {import("./back-types.d.ts").BackSteps} options */
export function createBackSteps({ S, LAYERS, placeOk, go, back }) {
  const canBack = () => LAYERS.open() || S.view !== "home" || S.trail.length > 0;
  /** One step back. False when there's nothing left in the app to go back to. */
  function stepBack() {
    if (LAYERS.back()) return true;
    if (S.view.startsWith("t:") || S.view.startsWith("c:")) { back(); return true; }
    while (S.trail.length) {
      const v = /** @type {string} */ (S.trail.pop());
      if (v === S.view || !placeOk(v)) continue;
      S.retrace = true; go(v); S.retrace = false;
      return true;
    }
    if (S.view !== "home") { S.retrace = true; go("home"); S.retrace = false; return true; }
    return false;
  }

  return { canBack, stepBack };
}
