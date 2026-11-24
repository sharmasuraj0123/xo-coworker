// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { parentOf } from "./scope.js";

/** @param {string} path @param {string} to */
const fits = (path, to) => to !== parentOf(path) && to !== path && !to.startsWith(path + "/");

/** @param {HTMLElement} host @param {() => string | null} scopeKey @param {(row: HTMLElement) => string | null} pathOfRow @param {(path: string) => string} base @param {(from: string, to: string) => void} moveTo */
export function wireFileDrag(host, scopeKey, pathOfRow, base, moveTo, scope = createScope()) {
  /** @type {{ path: string, key: string } | null} */
  let dragging = null;
  /** @param {HTMLElement} target */
  function destination(target) {
    const folder = /** @type {HTMLElement | null} */ (target.closest(".fl-g > .fl-r.is-dir"));
    if (folder?.dataset.flDir != null) return { path: folder.dataset.flDir, element: folder };
    const list = target.closest(".fl-list");
    return list && !target.closest(".fl-r, .fl-secs") ? { path: "", element: list } : null;
  }
  /** @type {Element | null} */
  let over = null;
  /** @param {Element | null} el */
  function mark(el) {
    if (over === el) return;
    over?.classList.remove("is-drop");
    over = el;
    el?.classList.add("is-drop");
  }
  scope.listen(host, "dragstart", (event) => {
    const e = /** @type {DragEvent} */ (event);
    const row = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest(".fl-g > .fl-r[draggable]"));
    const key = scopeKey();
    const path = row && pathOfRow(row);
    if (key == null || path == null || !e.dataTransfer) return;
    dragging = { path, key };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", path);
  });
  scope.listen(host, "dragover", (event) => {
    const e = /** @type {DragEvent} */ (event);
    const to = destination(/** @type {HTMLElement} */ (e.target));
    if (!to || !dragging || dragging.key !== scopeKey() || !fits(dragging.path, to.path)) { mark(null); return; }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    mark(to.element);
  });
  scope.listen(host, "dragleave", (e) => {
    if (!host.contains(/** @type {Node | null} */ ((/** @type {DragEvent} */ (e)).relatedTarget))) mark(null);
  });
  const reset = () => { dragging = null; mark(null); };
  scope.listen(host, "dragend", reset);
  scope.listen(host, "drop", (e) => {
    const to = destination(/** @type {HTMLElement} */ (e.target));
    const item = dragging;
    reset();
    if (!to || !item || item.key !== scopeKey() || !fits(item.path, to.path)) return;
    e.preventDefault();
    const name = base(item.path);
    moveTo(item.path, to.path ? `${to.path}/${name}` : name);
  });
  scope.effect(() => reset);
  return scope.dispose;
}
