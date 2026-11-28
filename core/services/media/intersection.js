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
      watcher.targets.get(img)?.();
    }
  }, { root: root === doc ? null : /** @type {Element} */ (root), rootMargin: "800px 0px" }), targets: new Map() };
  scope.observe(watcher.observer);
  watchers.set(root, watcher);
  return watcher;
}

/** @param {HTMLImageElement} img @param {() => void} start @param {ReturnType<typeof createScope>} scope */
export function watchNear(img, start, scope) {
  if (typeof IntersectionObserver !== "function") { start(); return; }
  const doc = img.ownerDocument;
  const root = img.closest(".scroller") || doc;
  const watcher = watchers.get(root) || createWatcher(root, doc);
  const stop = scope.effect(() => {
    watcher.targets.set(img, () => {
      stop();
      if (img.isConnected) start();
    });
    watcher.observer.observe(img);
    return () => unwatch(root, watcher, img);
  });
}
