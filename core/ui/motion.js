// @ts-check

// One motion system: one curve, three durations, one reduced-motion query; things arrive, glide and leave, never pop or jump.

/** The one curve, as css/tokens.css --ease. */
export const EASE = "cubic-bezier(.2,.8,.2,1)";
export const IN = 280, MOVE = 320, OUT = 160;
export const EXPAND_MS = 320;
/** The one reduced-motion query. */
export const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: true };
export const still = () => RM.matches || typeof Element === "undefined" || typeof Element.prototype.animate !== "function";

/** An animation's time: none under reduced motion. Never for time a person needs to act (see hold). @param {number} ms */
export const wait = (ms) => new Promise((r) => setTimeout(r, RM.matches ? 0 : ms));
/** Time a person has to act (an Undo window, a moment to read): real time, reduced motion or not. @param {number} ms */
export const hold = (ms) => new Promise((r) => setTimeout(r, ms));

/** An element arrives: fade in and settle. @param {Element | null | undefined} el */
export function arrive(el, { delay = 0 } = {}) {
  if (still() || !el) return;
  el.animate([{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: IN, delay, easing: EASE, fill: "backwards" });
}

/** An image shows itself once decoded: a soft fade, never a flash of a half-drawn picture. @param {HTMLImageElement | null | undefined} img */
export function fadeImage(img) {
  if (!img) return;
  const show = () => { if (still()) { img.style.opacity = ""; return; } img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN, easing: EASE }); img.style.opacity = ""; };
  img.style.opacity = "0";
  if (img.complete && img.naturalWidth) { show(); return; }
  const decoded = () => (typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve()).then(show); // loaded is not yet drawable
  img.addEventListener("load", decoded, { once: true });
  img.addEventListener("error", () => { img.style.opacity = ""; }, { once: true });
}

/** A list's children kept in step with items without redrawing what stayed: new ones arrive, pushed ones glide (FLIP), gone ones leave. @template {{ key: string }} T @param {any} box @param {T[]} items @param {{ make: (it: T) => HTMLElement, update: (el: HTMLElement, it: T) => void }} fns */
export function syncList(box, items, { make, update }) {
  /** @type {HTMLElement[]} */
  const kids = [...box.children];
  const old = new Map(kids.filter((el) => el.dataset.k).map((el) => [/** @type {string} */ (el.dataset.k), el]));
  for (const el of kids) if (!el.dataset.k) el.remove();
  const first = !box._seeded;
  const same = kids.length === items.length && items.every((it, i) => kids[i].dataset.k === it.key); // only patch in place
  if (same) { items.forEach((it, i) => update(kids[i], it)); box._seeded = true; return []; }
  const animate = !first && !still() && box.isConnected && box.getClientRects().length > 0;
  const before = animate ? new Map([...old].map(([k, el]) => [k, el.getBoundingClientRect()])) : null;
  /** @type {HTMLElement[]} */
  const fresh = [];
  const want = new Set(items.map((it) => it.key));
  for (const [k, el] of old) if (!want.has(k)) el.remove();
  /** @type {HTMLElement | null} */
  let prev = null;
  for (const it of items) {
    let el = old.get(it.key);
    if (!el) { el = make(it); el.dataset.k = it.key; fresh.push(el); }
    else update(el, it);
    const at = /** @type {Element | null} */ (prev ? prev.nextElementSibling : box.firstElementChild);
    if (at !== el) box.insertBefore(el, at || null);
    prev = el;
  }
  box._seeded = true;
  if (!before) return fresh;
  fresh.forEach((el, i) => arrive(el, { delay: Math.min(i, 4) * 40 }));
  for (const [k, r0] of before) {
    const el = old.get(k);
    if (!el || !el.isConnected) continue;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    // along its row it glides; to another row it settles in place
    if (Math.abs(dy) > 1) el.animate([{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: IN, delay: 60, easing: EASE, fill: "backwards" });
    else el.animate([{ transform: `translate(${dx}px,0)` }, { transform: "none" }], { duration: MOVE, easing: EASE });
  }
  return fresh;
}

/** Sets innerHTML only when it changed. @param {any} el @param {string} html */
export function setHtml(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; return true; } return false; }
/** Sets text only when it changed. @param {Element | null | undefined} el @param {string} text */
export function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

/** A smooth height change: measure, mutate, measure, animate the height while the new content cross-fades in. @param {Element | null | undefined} el @param {() => void} mutate @param {{ duration?: number, fade?: Element | null }} [opts] */
export function morph(el, mutate, { duration = 320, fade = null } = {}) {
  if (!el) { mutate(); return; }
  const h0 = el.getBoundingClientRect().height;
  mutate();
  if (RM.matches) return;
  const h1 = el.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) > 1) {
    el.getAnimations?.().forEach((a) => a.id === "morph" && a.cancel());
    const a = el.animate([{ height: `${h0}px`, overflow: "hidden" }, { height: `${h1}px`, overflow: "hidden" }], { duration, easing: EASE });
    a.id = "morph";
  }
  if (fade) fade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.round(duration * 0.8), easing: EASE, delay: Math.round(duration * 0.15), fill: "backwards" });
}

/** A smooth disclosure: box carries .is-open, body's height moves while its contents cross-fade; closed, body is hidden. @param {any} box @param {any} body @param {boolean} open @param {{ onStep?: (() => void) | null, frame?: any }} [opts] */
export function expand(box, body, open, { onStep = null, frame = null } = {}) {
  if (!box || !body) return;
  if (frame) { expandFrame(box, body, open, frame, onStep); return; }
  const was = box.classList.contains("is-open");
  if (was === open && !body._closing) return;
  const rm = RM.matches;
  body.getAnimations?.().forEach((/** @type {Animation} */ a) => a.cancel());
  const inner = body.firstElementChild;
  const h0 = was && !body.hidden ? body.getBoundingClientRect().height : 0;
  body._closing = false;
  if (open) {
    body.hidden = false;
    box.classList.add("is-open");
    if (rm) return;
    const h1 = body.getBoundingClientRect().height;
    const a = body.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
    body.style.overflow = "hidden";
    a.onfinish = a.oncancel = () => { body.style.overflow = ""; };
    if (inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: EASE, fill: "backwards" });
  } else {
    box.classList.remove("is-open");
    if (rm || !h0) { body.hidden = true; return; }
    body._closing = true;
    body.style.overflow = "hidden";
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE, fill: "forwards" });
    const a = body.animate([{ height: `${h0}px` }, { height: "0px" }], { duration: EXPAND_MS - 40, easing: EASE });
    a.onfinish = () => { if (body._closing) { body.hidden = true; body._closing = false; } body.style.overflow = ""; inner?.getAnimations?.().forEach((/** @type {Animation} */ x) => x.cancel()); };
  }
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/** The same for a card with a capped height: its frame animates, so the motion stays continuous once its body scrolls. @param {any} box @param {any} body @param {boolean} open @param {any} frame @param {(() => void) | null} onStep */
function expandFrame(box, body, open, frame, onStep) {
  const rm = RM.matches;
  frame.getAnimations?.().forEach((/** @type {Animation} */ a) => a.id === "xf" && a.cancel());
  const inner = body.firstElementChild;
  const h0 = frame.getBoundingClientRect().height;
  if (open) { body.hidden = false; box.classList.add("is-open"); }
  else { box.classList.remove("is-open"); body.hidden = true; }
  if (rm) return;
  const h1 = frame.getBoundingClientRect().height;
  if (!open) { body.hidden = false; }
  frame.style.overflow = "hidden";
  const a = frame.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
  a.id = "xf";
  if (open && inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: EASE, fill: "backwards" });
  if (!open && inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
  a.onfinish = a.oncancel = () => { frame.style.overflow = ""; if (!box.classList.contains("is-open")) body.hidden = true; inner?.getAnimations?.().forEach((/** @type {Animation} */ x) => x.cancel()); };
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/** Keeps every spinner, arc and shimmer turning in step, set once anything holding one is added, before the frame paints. */
export function keepTurning() {
  if (typeof document === "undefined" || !document.getAnimations) return;
  const sync = () => {
    for (const a of document.getAnimations()) {
      const name = /** @type {CSSAnimation} */ (a).animationName;
      if (name === "spin" || name === "arc-turn" || name === "shimmer") { if (a.startTime !== 0) a.startTime = 0; }
    }
  };
  const MOVING = ".arc, .spin, .shimmer, .tb-live";
  const moving = (/** @type {Node} */ n) => n.nodeType === 1 && (/** @type {Element} */ (n).matches(MOVING) || !!(/** @type {Element} */ (n)).querySelector(MOVING));
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (moving(n)) { sync(); return; }
  }).observe(document.body, { childList: true, subtree: true });
  sync();
}
