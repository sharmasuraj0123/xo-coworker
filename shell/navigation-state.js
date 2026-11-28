// @ts-check

import { createStore } from "../core/kernel/store.js";

/** @import { NavigationOptions } from "./navigation-types.d.ts" */

const TRAIL_LIMIT = 30;

/** @param {string} [initialView] */
export function createNavigationState(initialView = "home") {
  const state = createStore({ view: initialView });
  /** @type {Map<string, string | undefined>} */
  const parents = new Map();
  /** @type {Map<string, { view: string; key: string }>} */
  const returnRows = new Map();
  /** @type {Map<string, number>} */
  const scroll = new Map();
  /** @type {string[]} */
  let trail = [];

  /** @param {string} next @param {NavigationOptions} options */
  function visit(next, { from, row, remember = true }) {
    const { view } = state.get();
    if (next.startsWith("t:")) {
      parents.set(next, from || (view.startsWith("t:") ? parents.get(view) : view));
      if (row) returnRows.set(next, { view, key: row });
      else returnRows.delete(next);
    } else if (remember && !next.startsWith("c:")) {
      trail = [...trail.filter((entry) => entry !== next), view].slice(-TRAIL_LIMIT);
    }
    state.set({ view: next });
  }

  /** @param {string} previous @param {string} next */
  function takeReturnRow(previous, next) {
    const row = returnRows.get(previous);
    returnRows.delete(previous);
    return row?.view === next ? row.key : null;
  }

  /** @param {(view: string) => boolean} placeOk */
  function previousPlace(placeOk) {
    const { view } = state.get();
    while (trail.length) {
      const entry = trail.pop();
      if (entry && entry !== view && placeOk(entry)) return entry;
    }
    return view === "home" ? null : "home";
  }

  /** @param {string} view */
  const parentOf = (view) => parents.get(view);

  /** @param {string} view */
  const scrollOf = (view) => scroll.get(view) ?? 0;

  /** @param {string} view @param {number} offset */
  const saveScroll = (view, offset) => { scroll.set(view, offset); };

  return {
    view: () => state.get().view, parentOf, scrollOf, saveScroll,
    hasTrail: () => trail.length > 0,
    recent: () => [state.get().view, ...[...trail].reverse()],
    visit, takeReturnRow, previousPlace,
  };
}
