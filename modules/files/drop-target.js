// @ts-check

import { parentOf } from "./scope.js";

/** @typedef {{ path: string, key: string }} DragItem */

/** @param {Element} target @param {string | null} key @param {(row: HTMLElement) => string | null} pathOfRow @returns {DragItem | null} */
export function dragSource(target, key, pathOfRow) {
  if (key == null) return null;
  const row = /** @type {HTMLElement | null} */ (target.closest(".fl-g > .fl-r[draggable]"));
  const path = row && pathOfRow(row);
  return path == null ? null : { path, key };
}

/** @param {Element} target */
function destination(target) {
  const folder = /** @type {HTMLElement | null} */ (target.closest(".fl-g > .fl-r.is-dir"));
  if (folder?.dataset.flDir != null) return { path: folder.dataset.flDir, element: folder };
  const list = target.closest(".fl-list");
  return list && !target.closest(".fl-r, .fl-secs") ? { path: "", element: list } : null;
}

/** @param {string} path @param {string} to */
const fits = (path, to) => to !== parentOf(path) && to !== path && !to.startsWith(path + "/");

/** @param {Element} target @param {DragItem | null} item @param {string | null} key */
export function dropTarget(target, item, key) {
  if (!item || item.key !== key) return null;
  const to = destination(target);
  return to && fits(item.path, to.path) ? { ...to, from: item.path } : null;
}

export function createDropHighlight() {
  /** @type {Element | null} */
  let over = null;
  return (/** @type {Element | null} */ el) => {
    if (over === el) return;
    over?.classList.remove("is-drop");
    over = el;
    el?.classList.add("is-drop");
  };
}
