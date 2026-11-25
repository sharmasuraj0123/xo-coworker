// @ts-check

export { glide, follow, unstyle } from "./gesture-motion.js";

const LOCK = 10;     // px before a touch picks its direction
const SLOPE = 1.7;   // the picked axis must lead the other by this much: within ~30° of it
export const FLICK = 0.45; // px/ms: a quick flick commits whatever the distance

const IOS = /iP(hone|ad|od)/.test(navigator.platform) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
const STANDALONE = matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
/** Safari owns its left edge (its own Back, which history makes the app's Back); a home-screen app has none. @param {number} x */
export const edgeIsSafari = (x) => IOS && !STANDALONE && x < 24;

/** The one touch a gesture owns. @type {object | null} */
let claimed = null;
/** @type {WeakSet<TouchEvent>} */
const starts = new WeakSet();

export function tick() {
  try { navigator.vibrate?.(8); }
  catch (error) { if (!(error instanceof DOMException) || !["NotAllowedError", "SecurityError"].includes(error.name)) throw error; }
}

/** Does something between `el` and `root` scroll sideways (a code block, the Now shelf, a table)? @param {Element} el @param {Element | null} [root] */
export function scrollsX(el, root) {
  for (let n = /** @type {Element | null} */ (el); n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) { const o = getComputedStyle(n).overflowX; if (o === "auto" || o === "scroll") return true; }
  }
  return false;
}
/** How far the nearest vertical scroller from `el` up to `root` is from its top (0: at the top, or none). @param {Element} el @param {Element | null} [root] */
export function scrolledY(el, root) {
  for (let n = /** @type {Element | null} */ (el); n; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) { const o = getComputedStyle(n).overflowY; if (o === "auto" || o === "scroll") return n.scrollTop; }
    if (n === root) break;
  }
  return 0;
}
const selecting = () => { const s = getSelection(); return !!s && !s.isCollapsed && String(s).trim() !== ""; };

/** @typedef {{ axis: "x" | "y", signal?: AbortSignal, start?: (t: { x: number, y: number, target: Element }) => boolean | void, accept?: (dx: number, dy: number) => boolean | void, move: (dx: number, dy: number) => void, end: (dx: number, dy: number, vx: number, vy: number) => unknown, cancel?: () => void }} Drag */

/** One finger, one axis: start/accept may refuse the touch; end gets the velocity in px/ms. @param {HTMLElement} el @param {Drag} o */
export function drag(el, o) {
  /** @type {{ id: number, x0: number, y0: number, locked: boolean, pts: number[][] } | null} */
  let s = null;
  const drop = () => { if (s && claimed === s) claimed = null; s = null; };
  const cancel = () => { if (s?.locked) o.cancel?.(); drop(); };
  o.signal?.addEventListener("abort", cancel, { once: true });
  el.addEventListener("touchstart", (e) => {
    s = null;
    if (e.touches.length !== 1) return;
    if (!starts.has(e)) {
      starts.add(e);
      claimed = null;
    }
    const p = e.touches[0];
    if (o.start && o.start({ x: p.clientX, y: p.clientY, target: /** @type {Element} */ (e.target) }) === false) return;
    s = { id: p.identifier, x0: p.clientX, y0: p.clientY, locked: false, pts: [[p.clientX, p.clientY, e.timeStamp]] };
  }, { passive: true, signal: o.signal });
  el.addEventListener("touchmove", (e) => {
    if (!s) return;
    const p = [...e.touches].find((x) => x.identifier === /** @type {NonNullable<typeof s>} */ (s).id);
    if (!p || e.touches.length !== 1) { cancel(); return; }
    const dx = p.clientX - s.x0, dy = p.clientY - s.y0;
    if (!s.locked) {
      if (claimed) { s = null; return; }
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      const [a, b] = o.axis === "x" ? [dx, dy] : [dy, dx];
      if (Math.abs(a) < Math.abs(b) * SLOPE || !e.cancelable || selecting() || (o.accept && o.accept(dx, dy) === false)) { s = null; return; }
      s.locked = true; claimed = s;
    }
    if (e.cancelable) e.preventDefault();
    s.pts.push([p.clientX, p.clientY, e.timeStamp]);
    if (s.pts.length > 6) s.pts.shift();
    o.move(dx, dy);
  }, { passive: false, signal: o.signal });
  el.addEventListener("touchend", (e) => {
    if (!s) return;
    const st = s;
    drop();
    if (!st.locked) return;
    const p = [...e.changedTouches].find((x) => x.identifier === st.id) || e.changedTouches[0];
    const now = e.timeStamp;
    const old = st.pts.find((q) => now - q[2] < 90) || st.pts[st.pts.length - 1];
    const dt = Math.max(1, now - old[2]);
    Promise.resolve(o.end(p.clientX - st.x0, p.clientY - st.y0, (p.clientX - old[0]) / dt, (p.clientY - old[1]) / dt))
      .finally(() => {
        if (!o.signal?.aborted) document.dispatchEvent(new CustomEvent("xo:gesture"));
      });
  }, { signal: o.signal });
  el.addEventListener("touchcancel", cancel, { signal: o.signal });
}
