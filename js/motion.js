// One motion system (design-research/15): one easing and three durations, used everywhere something
// arrives, moves or leaves. Things never pop and never jump:
//   · a new item fades in and settles 6 px into place (transform and opacity only: no layout shift);
//   · items it pushes along glide to their new place (FLIP); one that wraps to another row settles
//     there instead of cutting across the others;
//   · an image fades in once it has decoded, never as a half-drawn flash;
//   · an item that only changed (its time, its pin, its picture) is updated in place, never redrawn.
// Reduced motion: everything lands at once.
//
// The same values are CSS custom properties in css/foundation.css (--m-ease, --m-in, --m-move, --m-out).

// The same values as Plan F in css/tokens.css (--ease, --d-in, --d-move, --d-out); change them together.
export const EASE = "cubic-bezier(.2,.8,.2,1)";
export const IN = 280, MOVE = 320, OUT = 160;
const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: true };
export const still = () => RM.matches || typeof Element === "undefined" || typeof Element.prototype.animate !== "function";

/** An element arrives: fade in and settle. */
export function arrive(el, { delay = 0 } = {}) {
  if (still() || !el) return;
  el.animate([{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: IN, delay, easing: EASE, fill: "backwards" });
}

/** An image shows itself once decoded: a soft fade, never a flash of a half-drawn picture. */
export function fadeImage(img) {
  if (!img) return;
  const show = () => { if (still()) { img.style.opacity = ""; return; } img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN, easing: EASE }); img.style.opacity = ""; };
  img.style.opacity = "0";
  if (img.complete && img.naturalWidth) { show(); return; }
  // loaded is not yet drawable: a big picture can still be decoding, so wait for that too
  const decoded = () => (typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve()).then(show);
  img.addEventListener("load", decoded, { once: true });
  img.addEventListener("error", () => { img.style.opacity = ""; }, { once: true });
}

/**
 * Keep a list's children in step with `items` ([{key, ...}]) without redrawing what stayed:
 * make(item) → a new element; update(el, item) patches it in place. New elements arrive (after the
 * list's first fill, which lands still); the ones they push aside glide (FLIP); gone ones leave.
 */
export function syncList(box, items, { make, update }) {
  const kids = [...box.children];
  const old = new Map(kids.filter((el) => el.dataset.k).map((el) => [el.dataset.k, el]));
  for (const el of kids) if (!el.dataset.k) el.remove();
  const first = !box._seeded;
  // the same keys in the same order: only patch in place (no measuring, nothing moves)
  const same = kids.length === items.length && items.every((it, i) => kids[i].dataset.k === it.key);
  if (same) { items.forEach((it, i) => update(kids[i], it)); box._seeded = true; return []; }
  const animate = !first && !still() && box.isConnected && box.getClientRects().length > 0;
  const before = animate ? new Map([...old].map(([k, el]) => [k, el.getBoundingClientRect()])) : null;
  const fresh = [];
  const want = new Set(items.map((it) => it.key));
  for (const [k, el] of old) if (!want.has(k)) el.remove();
  let prev = null;
  for (const it of items) {
    let el = old.get(it.key);
    if (!el) { el = make(it); el.dataset.k = it.key; fresh.push(el); }
    else update(el, it);
    const at = prev ? prev.nextElementSibling : box.firstElementChild;
    if (at !== el) box.insertBefore(el, at || null);
    prev = el;
  }
  box._seeded = true;
  if (!animate) return fresh;
  fresh.forEach((el, i) => arrive(el, { delay: Math.min(i, 4) * 40 }));
  for (const [k, r0] of before) {
    const el = old.get(k);
    if (!el || !el.isConnected) continue;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    // along its row it glides; to another row it would cut across the others, so it settles in place
    if (Math.abs(dy) > 1) el.animate([{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: IN, delay: 60, easing: EASE, fill: "backwards" });
    else el.animate([{ transform: `translate(${dx}px,0)` }, { transform: "none" }], { duration: MOVE, easing: EASE });
  }
  return fresh;
}

/** Set an element's innerHTML only when it changed (so nothing inside it is redrawn for nothing). */
export function setHtml(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; return true; } return false; }
/** Set text only when it changed. */
export function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
