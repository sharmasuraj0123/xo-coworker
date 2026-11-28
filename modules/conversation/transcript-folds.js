// @ts-check

import { createStore } from "../../core/kernel/store.js";

/** @typedef {{ host: Element, key: string, open: boolean, restoreFocus: boolean }} FoldChange */

/** @typedef {{ open: Readonly<Record<string, boolean>>, change: FoldChange | null }} FoldState */

export function createTranscriptFolds() {
  const state = createStore(/** @type {FoldState} */ ({ open: {}, change: null }));

  /** @param {string} key @param {{ host: Element, restoreFocus: boolean }} [origin] */
  function toggle(key, origin) {
    const { open } = state.get();
    const expanded = !Object.hasOwn(open, key) || !open[key];
    state.set({
      open: Object.freeze({ ...open, [key]: expanded }),
      ...(origin && { change: { ...origin, key, open: expanded } }),
    });
  }

  /** @param {Element} host */
  function takeChange(host) {
    const { change } = state.get();
    if (change?.host !== host) return null;
    state.set({ change: null });
    return change;
  }

  return { open: () => state.get().open, toggle, takeChange };
}
