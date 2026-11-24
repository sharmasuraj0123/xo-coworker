// @ts-check

import { createScope } from "../core/kernel/scope.js";

/** @param {{canBack(): boolean, stepBack(): boolean}} o @param {Window} [win] @param {Document} [doc] */
export function wireBack({ canBack, stepBack }, win = window, doc = document) {
  const scope = createScope();
  const HIST = { armed: win.history.state?.xo === 1 };
  function armBack() {
    if (HIST.armed || !canBack()) return;
    try {
      win.history.pushState({ ...win.history.state, xo: 1 }, "");
      HIST.armed = true;
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "SecurityError")) throw error;
    }
  }
  scope.listen(win, "popstate", () => {
    HIST.armed = win.history.state?.xo === 1;
    if (HIST.armed) return; // forward onto our own entry: nothing to undo
    if (!stepBack()) { win.history.back(); return; }
    armBack();
  });
  // Browser Back can skip history entries inserted without a user gesture.
  const armAfterInput = () => { scope.timeout(armBack, 0); };
  scope.listen(doc, "click", armAfterInput, true);
  scope.listen(win, "keyup", armAfterInput, true);
  scope.listen(doc, "touchend", armAfterInput, { capture: true, passive: true });
  scope.listen(doc, "xo:gesture", armBack);
  return scope.dispose;
}
