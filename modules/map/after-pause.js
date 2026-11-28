// @ts-check
import { createScope } from "../../core/kernel/scope.js";
const PAUSE_MS = 120, MAX_MS = 700;
/** @param {() => void} fn */
export function afterPause(fn) {
  let last = performance.now();
  const start = last, scope = createScope();
  const seen = () => { last = performance.now(); };
  for (const ev of ["keydown", "pointerdown", "wheel", "touchstart"]) scope.listen(globalThis, ev, seen, { capture: true, passive: true });
  const remaining = (now = performance.now()) => now - start < MAX_MS ? PAUSE_MS - (now - last) : 0;
  const check = (ms = remaining()) => { if (ms > 0) scope.timeout(check, ms); else { scope.dispose(); fn(); } };
  scope.frame(() => scope.timeout(check, 0)); return scope.dispose;
}
