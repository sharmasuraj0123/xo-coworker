// @ts-check

import { createInViewQueue } from "../../core/ui/in-view.js";
import { PREVIEW_CONCURRENCY } from "./preview-queue.js";

/** @typedef {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} Scope */

/** @param {Scope} scope @param {ReturnType<typeof import("./previews.js").createPreviews>} previews */
export function createMadeThumbnails(scope, previews) {
  /** @type {WeakMap<Element, import("./types.d.ts").Made>} */
  const candidates = new WeakMap();
  const sync = typeof IntersectionObserver === "function" ? createInViewQueue({
    scope, concurrency: PREVIEW_CONCURRENCY,
    async read(node) {
      const item = candidates.get(node);
      if (item) await previews.loadThumbs([item]);
    },
  }) : null;
  /** @param {HTMLElement} host @param {import("./types.d.ts").Made[]} items */
  return function watch(host, items) {
    if (!sync) return;
    const images = new Map(items.filter((m) => m.kind === "image" && !previews.thumbs.has(m.key)).map((m) => [m.key, m]));
    const nodes = [];
    for (const card of /** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll(".md-it"))) {
      const item = images.get(card.dataset.k || "");
      if (item) { candidates.set(card, item); nodes.push(card); } else candidates.delete(card);
    }
    sync(nodes);
  };
}
