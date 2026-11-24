// @ts-check

import { createScope } from "../../kernel/scope.js";

/** @typedef {ReturnType<typeof createScope>} Scope */

/** @type {WeakMap<Document, ReturnType<typeof monitor>>} */
const monitors = new WeakMap();

/** @param {Document} doc */
function monitor(doc) {
  const scope = createScope();
  /** @type {Map<HTMLImageElement, Set<Scope>>} */
  const active = new Map();
  const Observe = doc.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new Observe((records) => {
    if (!records.some((record) => record.removedNodes.length)) return;
    for (const [img, leases] of active) {
      if (img.isConnected && img.ownerDocument === doc) continue;
      for (const lease of leases) lease.dispose();
    }
  });
  scope.observe(observer);
  observer.observe(doc, { childList: true, subtree: true });
  return { scope, active };
}

/** @param {HTMLImageElement} img */
export function createImageScope(img) {
  const scope = createScope();
  if (!img.isConnected) {
    scope.dispose();
    return scope;
  }
  const doc = img.ownerDocument;
  const tracker = monitors.get(doc) ?? monitor(doc);
  monitors.set(doc, tracker);
  const leases = tracker.active.get(img) ?? new Set();
  tracker.active.set(img, leases);
  leases.add(scope);
  scope.effect(() => () => {
    leases.delete(scope);
    if (!leases.size) tracker.active.delete(img);
    if (tracker.active.size) return;
    tracker.scope.dispose();
    monitors.delete(doc);
  });
  return scope;
}
