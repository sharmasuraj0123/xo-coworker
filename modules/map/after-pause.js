// @ts-check

const PAUSE_MS = 120, MAX_MS = 700;
/** @param {() => void} fn */
export function afterPause(fn) {
  let last = performance.now();
  const start = last, seen = () => { last = performance.now(); };
  const evs = ["keydown", "pointerdown", "wheel", "touchstart"];
  for (const ev of evs) addEventListener(ev, seen, { capture: true, passive: true });
  const go = () => { for (const ev of evs) removeEventListener(ev, seen, { capture: true }); fn(); };
  const check = () => { const now = performance.now(); if (now - last >= PAUSE_MS || now - start >= MAX_MS) go(); else setTimeout(check, PAUSE_MS - (now - last)); };
  requestAnimationFrame(() => setTimeout(check, 0));
}
