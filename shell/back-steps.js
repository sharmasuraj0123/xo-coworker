// @ts-check

/** @param {import("./back-types.d.ts").BackSteps} options */
export function createBackSteps({ location, LAYERS, placeOk, go, back }) {
  const canBack = () => LAYERS.open() || location.view() !== "home" || location.hasTrail();
  /** One step back. False when there's nothing left in the app to go back to. */
  function stepBack() {
    if (LAYERS.back()) return true;
    const view = location.view();
    if (view.startsWith("t:") || view.startsWith("c:")) { back(); return true; }
    const previous = location.previousPlace(placeOk);
    if (!previous) return false;
    go(previous, { remember: false });
    return true;
  }

  return { canBack, stepBack };
}
