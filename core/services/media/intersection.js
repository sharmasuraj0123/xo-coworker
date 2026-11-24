// @ts-check

import { createScope } from "../../kernel/scope.js";

/** @typedef {{ scope: ReturnType<typeof createScope>, observer: IntersectionObserver, targets: Map<HTMLImageElement, () => void> }} Watcher */

/** @type {WeakMap<Document | Element, Watcher>} */
const watchers = new WeakMap();

/** @param {Document | Element} root @param {Watcher} watcher @param {HTMLImageElement} img */
function unwatch(root, watcher, img) {
  watcher.targets.delete(img);
  watcher.observer.unobserve(img);
  if (watcher.targets.size) return;
  watcher.scope.dispose();
  watchers.delete(root);
}

/** @param {Document | Element} root @param {Document} doc */
function createWatcher(root, doc) {
  const scope = createScope();
  /** @type {Watcher} */
  const watcher = { scope, observer: new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      const img = /** @type {HTMLImageElement} */ (target);
      const start = watcher.targets.get(img);
      if (!start) continue;
      unwatch(root, watcher, img);
      if (img.isConnected) start();
    }
  }, { root: root === doc ? null : /** @type {Element} */ (root), rootMargin: "800px 0px" }), targets: new Map() };
  scope.observe(watcher.observer);
  const removals = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1 || node.isConnected) continue;
        const el = /** @type {Element} */ (node);
        const imgs = el.matches("img.mx-img") ? [el] : el.querySelectorAll("img.mx-img");
        for (const target of imgs) {
          const img = /** @type {HTMLImageElement} */ (target);
          if (watcher.targets.has(img)) unwatch(root, watcher, img);
        }
      }
    }
  });
  scope.observe(removals);
  removals.observe(doc, { subtree: true, childList: true });
  watchers.set(root, watcher);
  return watcher;
}

/** @param {HTMLImageElement} img @param {() => void} start */
export function watchNear(img, start) {
  if (typeof IntersectionObserver !== "function") { start(); return; }
  const doc = img.ownerDocument;
  const root = img.closest(".scroller") || doc;
  const watcher = watchers.get(root) || createWatcher(root, doc);
  watcher.targets.set(img, start);
  watcher.observer.observe(img);
}
