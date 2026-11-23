// @ts-check

// The phone's own Back (Android's back gesture, Safari's edge swipe): one history entry of the app's own while there's somewhere to go back to.

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

/** Back takes one step in the app, and with nothing left the browser leaves. @param {{ canBack: () => boolean, stepBack: () => boolean }} o @param {Window} [win] @param {Document} [doc] */
export function wireBack({ canBack, stepBack }, win = window, doc = document) {
  const HIST = { armed: win.history.state?.xo === 1 };
  function armBack() {
    if (HIST.armed || !canBack()) return;
    try { win.history.pushState({ ...(win.history.state || {}), xo: 1 }, ""); HIST.armed = true; } catch { /* a sandboxed frame */ }
  }
  win.addEventListener("popstate", () => {
    HIST.armed = win.history.state?.xo === 1;
    if (HIST.armed) return; // forward onto our own entry: nothing to undo
    if (!stepBack()) { win.history.back(); return; }
    armBack();
  });
  // arm on the person's own taps and keys (an entry pushed without one can be skipped by Back)
  doc.addEventListener("click", () => setTimeout(armBack, 0), true);
  win.addEventListener("keyup", () => setTimeout(armBack, 0), true);
  doc.addEventListener("touchend", () => setTimeout(armBack, 0), { capture: true, passive: true });
  doc.addEventListener("xo:gesture", armBack);
}
