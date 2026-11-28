// @ts-check

import { createScope } from "../kernel/scope.js";
import { EASE, RM } from "./motion.js";

/** @typedef {{ms?: number, opacity?: number, scope?: import("../kernel/types").Lifetime}} GlideOptions */

/** @param {HTMLElement} el @param {string} transform @param {GlideOptions} [options] @returns {Promise<void>} */
export function glide(el, transform, { ms = 220, opacity, scope = createScope() } = {}) {
  if (scope.signal.aborted) return Promise.resolve();
  const duration = RM.matches ? 0 : ms;
  el.style.transition = duration ? `transform ${duration}ms ${EASE}, opacity ${duration}ms ${EASE}` : "none";
  el.style.transform = transform;
  if (opacity != null) el.style.opacity = String(opacity);
  return new Promise((resolve) => {
    const cancel = scope.timeout(() => finish(), duration);
    const finish = scope.effect(() => () => { cancel(); resolve(); });
  });
}

/** @param {HTMLElement} el @param {string} transform @param {number} [opacity] */
export function follow(el, transform, opacity) {
  el.style.transition = "none";
  el.style.transform = transform;
  if (opacity != null) el.style.opacity = String(opacity);
}

/** @param {...(HTMLElement | null | undefined)} elements */
export function unstyle(...elements) {
  for (const el of elements) {
    if (!el) continue;
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }
}
