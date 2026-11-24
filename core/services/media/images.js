// @ts-check

import { createScope } from "../../kernel/scope.js";
import { api } from "../../platform/api.js";
import { createLru } from "../../platform/cache.js";
import { once } from "../../platform/pending.js";
import { MEDIA_CACHE_MAX } from "./cache.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

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
function retire(url) {
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

/** @type {ReturnType<typeof createLru<string, string>>} */
const blobs = createLru({ max: MEDIA_CACHE_MAX, onEvict: retire });

/** @param {MediaItem | null | undefined} it */
export const cachedSrc = (it) => it ? it.src || blobs.get(it.key) || null : null;

/** @param {MediaItem} it */
export function forgetSrc(it) {
  const url = blobs.get(it.key);
  if (url && blobs.delete(it.key)) retire(url);
}

/** @param {HTMLImageElement} img @param {MediaItem | null | undefined} it */
export async function showSrc(img, it) {
  const cached = cachedSrc(it);
  if (cached) {
    img.src = cached;
    return;
  }
  if (!it?.project || !it.rel) throw new Error("No picture");
  const { key, project, rel } = it;
  const blob = await once(`media-image:${key}`, () => api.projectImage(project, rel));
  if (!img.isConnected) return;
  const existing = blobs.get(key);
  const url = existing ?? URL.createObjectURL(blob);
  img.src = url;
  if (!existing) blobs.set(key, url);
}
