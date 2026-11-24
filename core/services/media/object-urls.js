// @ts-check

import { createScope } from "../../kernel/scope.js";

/** @type {Set<string>} */
const retired = new Set();
/** @type {ReturnType<typeof createScope> | undefined} */
let tracking;

/** @param {string} url */
const isShown = (url) => !!document.querySelector(`img[src="${url}"]`);

/** @param {MutationRecord[]} records */
function releaseUnused(records) {
  /** @type {Set<string | null>} */
  const sources = new Set();
  for (const record of records) {
    if (record.type === "attributes" && (/** @type {Element} */ (record.target)).matches("img")) sources.add(record.oldValue);
    for (const node of record.removedNodes) {
      if (node.nodeType !== 1 || node.isConnected) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches("img")) sources.add(el.getAttribute("src"));
      for (const img of el.querySelectorAll("img[src]")) sources.add(img.getAttribute("src"));
    }
  }
  for (const url of sources) {
    if (url && retired.has(url) && !isShown(url)) {
      retired.delete(url);
      URL.revokeObjectURL(url);
    }
  }
  if (!retired.size) {
    tracking?.dispose();
    tracking = undefined;
  }
}

/** @param {string} url */
export function retire(url) {
  if (!isShown(url)) {
    URL.revokeObjectURL(url);
    return;
  }
  retired.add(url);
  if (tracking) return;
  tracking = createScope();
  const observer = new MutationObserver(releaseUnused);
  tracking.observe(observer);
  observer.observe(document, { subtree: true, childList: true, attributeFilter: ["src"], attributeOldValue: true });
}
