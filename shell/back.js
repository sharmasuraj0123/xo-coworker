// @ts-check

// The phone's own Back (Android's back gesture, Safari's edge swipe): one history entry of the app's own while there's somewhere to go back to.

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
