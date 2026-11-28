// @ts-check

import { createScope } from "../kernel/scope.js";
import { EASE, RM } from "../platform/motion.js";
import { reportFailure } from "../platform/util.js";
import { IN, MOVE, OUT } from "./tokens.js";

export { EASE, RM, MOVE, OUT };
export const EXPAND_MS = MOVE;
export const still = () => RM.matches || typeof Element === "undefined" || typeof Element.prototype.animate !== "function";

/** @param {number} ms @param {Pick<import("../kernel/types").ModuleContext, "delay">} [scope] */
export const wait = (ms, scope = createScope()) => scope.delay(RM.matches ? 0 : ms);

/** @param {number} ms @param {Pick<import("../kernel/types").ModuleContext, "delay">} [scope] */
export const hold = (ms, scope = createScope()) => scope.delay(ms);

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
  const decoded = () => (typeof img.decode === "function" ? img.decode().catch((error) => {
    if (!(error instanceof DOMException && error.name === "EncodingError")) reportFailure(error);
  }) : Promise.resolve()).then(show);
  img.addEventListener("load", decoded, { once: true });
  img.addEventListener("error", () => { img.style.opacity = ""; }, { once: true });
}

const seededLists = new WeakSet();
export function seedList(/** @type {Element} */ box, /** @type {boolean} */ seeded) {
  if (seeded) seededLists.add(box); else seededLists.delete(box);
}
export const listSeeded = (/** @type {Element} */ box) => seededLists.has(box);

/** @template {{key: string}} T @param {HTMLElement} box @param {T[]} items @param {import("./motion-types.d.ts").ListDraw<T>} fns */
export function syncList(box, items, { make, update }) {
  const kids = /** @type {HTMLElement[]} */ ([...box.children]);
  const old = new Map();
  for (const el of kids) if (el.dataset.k) old.set(el.dataset.k, el); else el.remove();
  const first = !listSeeded(box);
  const same = kids.length === items.length && items.every((it, i) => kids[i].dataset.k === it.key); // only patch in place
  if (same) { items.forEach((it, i) => update(kids[i], it)); seedList(box, true); return []; }
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
  seedList(box, true);
  if (!before) return fresh;
  fresh.forEach((el, i) => arrive(el, { delay: Math.min(i, 4) * 40 }));
  for (const [k, r0] of before) {
    const el = old.get(k);
    if (!el || !el.isConnected) continue;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    if (Math.abs(dy) > 1) el.animate([{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: IN, delay: 60, easing: EASE, fill: "backwards" });
    else el.animate([{ transform: `translate(${dx}px,0)` }, { transform: "none" }], { duration: MOVE, easing: EASE });
  }
  return fresh;
}

/** Sets text only when it changed. @param {Element | null | undefined} el @param {string} text */
export function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

/** A smooth height change: measure, mutate, measure, animate the height while the new content cross-fades in. @param {Element | null | undefined} el @param {() => void} mutate @param {{ duration?: number, fade?: Element | null }} [opts] */
export function morph(el, mutate, { duration = MOVE, fade = null } = {}) {
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

const closing = new WeakSet();

/** @type {WeakMap<Element, ReturnType<typeof createScope>>} */
const steps = new WeakMap();

/** @param {Element} owner @param {() => void} onStep */
function trackExpansion(owner, onStep) {
  const scope = createScope();
  const deadline = performance.now() + EXPAND_MS + 40;
  const connected = owner.isConnected;
  steps.set(owner, scope);
  scope.effect(() => () => steps.delete(owner));
  const page = owner.ownerDocument.defaultView;
  if (page) scope.listen(page, "pagehide", (event) => { if (!("persisted" in event && event.persisted)) scope.dispose(); });
  const step = () => {
    if (connected && !owner.isConnected) { scope.dispose(); return; }
    try { onStep(); } catch (error) { scope.dispose(); throw error; }
    if (performance.now() < deadline) scope.frame(step); else scope.dispose();
  };
  scope.frame(step);
}

/** @param {Element | null} box @param {HTMLElement | null} body @param {boolean} open @param {import("./motion-types.d.ts").ExpandOptions} [opts] */
export function expand(box, body, open, { onStep = null, frame = null } = {}) {
  if (!box || !body) return;
  if (frame) { expandFrame(box, body, open, /** @type {HTMLElement} */ (frame), onStep); return; }
  const was = box.classList.contains("is-open");
  if (was === open && !closing.has(body)) return;
  steps.get(body)?.dispose();
  const rm = RM.matches;
  body.getAnimations?.().forEach((/** @type {Animation} */ a) => a.cancel());
  const inner = body.firstElementChild;
  const h0 = was && !body.hidden ? body.getBoundingClientRect().height : 0;
  closing.delete(body);
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
    closing.add(body);
    body.style.overflow = "hidden";
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: EASE, fill: "forwards" });
    const a = body.animate([{ height: `${h0}px` }, { height: "0px" }], { duration: EXPAND_MS - 40, easing: EASE });
    a.onfinish = () => { if (closing.delete(body)) body.hidden = true; body.style.overflow = ""; inner?.getAnimations?.().forEach((x) => x.cancel()); };
  }
  if (onStep) trackExpansion(body, onStep);
}

/** @param {Element} box @param {HTMLElement} body @param {boolean} open @param {HTMLElement} frame @param {(() => void) | null} onStep */
function expandFrame(box, body, open, frame, onStep) {
  steps.get(frame)?.dispose();
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
  if (!open && inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, fill: "forwards" });
  a.onfinish = a.oncancel = () => { frame.style.overflow = ""; if (!box.classList.contains("is-open")) body.hidden = true; inner?.getAnimations?.().forEach((/** @type {Animation} */ x) => x.cancel()); };
  if (onStep) trackExpansion(frame, onStep);
}

export function keepTurning() {
  if (typeof document === "undefined" || !document.getAnimations) return;
  const sync = () => {
    for (const a of document.getAnimations()) {
      const name = /** @type {CSSAnimation} */ (a).animationName;
      if (name === "spin" || name === "arc-turn" || name === "shimmer" || String(name).startsWith("dot-")) { if (a.startTime !== 0) a.startTime = 0; }
    }
  };
  const MOVING = ".arc, .g-working, .spin, .shimmer, .tb-live, .dots";
  const moving = (/** @type {Node} */ n) => n.nodeType === 1 && (/** @type {Element} */ (n).matches(MOVING) || !!(/** @type {Element} */ (n)).querySelector(MOVING));
  const observer = new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (moving(n)) { sync(); return; }
  });
  sync();
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Adds cls; done runs after what it starts, unless cls went first. @param {Element} el @param {string} cls @param {() => void} done */
export function leaveWith(el, cls, done) {
  if (el.classList.contains(cls)) return;
  el.classList.add(cls);
  const end = () => { if (!el.classList.contains(cls)) return; el.classList.remove(cls); done(); };
  const out = el.getAnimations?.() ?? [];
  if (out.length) void Promise.allSettled(out.map((a) => a.finished)).then(end); else end();
}

/** Removed matches stay inert while they fade or fold. @param {Element} host @param {string} selector @param {() => void} draw */
export function drawLeaving(host, selector, draw, fold = false) {
  if (still()) { draw(); return; }
  const was = [...host.querySelectorAll(selector)].filter((el) => !el.hasAttribute("data-own"))
    .map((el) => ({ el, parent: el.parentNode, next: el.nextSibling, h: el.getBoundingClientRect().height }));
  draw();
  for (const { el, parent, next, h } of was.reverse()) {
    if (el.isConnected || !parent?.isConnected) continue;
    el.setAttribute("data-own", "");
    el.setAttribute("inert", "");
    parent.insertBefore(el, next?.parentNode === parent ? next : null);
    const a = fold
      ? el.animate([{ height: `${h}px`, opacity: 1, overflow: "hidden" },
        { height: "0px", minHeight: "0px", paddingBlock: "0px", borderBottomWidth: "0px", opacity: 0, overflow: "hidden" }],
      { duration: MOVE, easing: EASE, fill: "forwards" })
      : el.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-2px) scale(.99)" }],
        { duration: OUT, easing: EASE, fill: "forwards" });
    a.onfinish = a.oncancel = () => el.remove();
  }
}
