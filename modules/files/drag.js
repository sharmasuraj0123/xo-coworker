// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createDropHighlight, dragSource, dropTarget } from "./drop-target.js";

/** @param {HTMLElement} host @param {() => string | null} scopeKey @param {(row: HTMLElement) => string | null} pathOfRow @param {(path: string) => string} base @param {(from: string, to: string) => void} moveTo */
export function wireFileDrag(host, scopeKey, pathOfRow, base, moveTo, scope = createScope()) {
  /** @type {ReturnType<typeof dragSource>} */
  let dragging = null;
  const mark = createDropHighlight();
  scope.listen(host, "dragstart", (event) => {
    const e = /** @type {DragEvent} */ (event);
    const item = dragSource(/** @type {Element} */ (e.target), scopeKey(), pathOfRow);
    if (!item || !e.dataTransfer) return;
    dragging = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.path);
  });
  scope.listen(host, "dragover", (event) => {
    const e = /** @type {DragEvent} */ (event);
    const to = dropTarget(/** @type {Element} */ (e.target), dragging, scopeKey());
    if (!to) { mark(null); return; }
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
    const to = dropTarget(/** @type {Element} */ (e.target), dragging, scopeKey());
    reset();
    if (!to) return;
    e.preventDefault();
    const name = base(to.from);
    moveTo(to.from, to.path ? `${to.path}/${name}` : name);
  });
  scope.effect(() => reset);
  return scope.dispose;
}
