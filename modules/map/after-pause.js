// @ts-check
import { createScope } from "../../core/kernel/scope.js";
const PAUSE_MS = 120, MAX_MS = 700;
/** @param {() => void} fn */
export function afterPause(fn) {
  const scope = createScope();
  const start = performance.now();
  let last = start;
  const seen = () => { last = performance.now(); };
  for (const event of ["keydown", "pointerdown", "wheel", "touchstart"]) {
    scope.listen(globalThis, event, seen, { capture: true, passive: true });
  }
  const check = () => {
    const now = performance.now();
    if (now - last >= PAUSE_MS || now - start >= MAX_MS) { scope.dispose(); fn(); }
    else scope.timeout(check, PAUSE_MS - (now - last));
  };
  scope.frame(() => scope.timeout(check, 0));
  return scope.dispose;
}
