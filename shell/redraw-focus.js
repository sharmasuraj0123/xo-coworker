// @ts-check

import { $ } from "../core/platform/dom.js";
import { usable } from "../core/ui/a11y/focus.js";

/** @typedef {string | (() => HTMLElement | null | undefined)} Target */

export function createRedrawFocus() {
  /** @type {Target[] | null} */
  let pending = null;
  return {
    /** @param {Target[]} targets */
    request(targets) { pending = targets; },
    /** @param {Target[]} targets @param {() => HTMLElement} region @param {() => void} schedule */
    back(targets, region, schedule) {
      const target = region();
      if (usable(target)) target.focus({ preventScroll: true });
      pending = [...targets, region];
      schedule();
    },
    restore() {
      const targets = pending;
      if (!targets) return;
      const target = targets.map((candidate) => typeof candidate === "function" ? candidate() : $(candidate)).find(usable);
      pending = null;
      target?.focus({ preventScroll: true });
    },
  };
}
