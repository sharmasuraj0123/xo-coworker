// @ts-check

import { createLru } from "../../platform/cache.js";
import { latest } from "../../platform/pending.js";
import { MEDIA_CACHE_MAX } from "./cache.js";
import { createImageScope } from "./image-scope.js";
import { subscribeProjectImage } from "./project-images.js";
import { retire } from "./object-urls.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** @type {ReturnType<typeof createLru<string, string>>} */
const blobs = createLru({ max: MEDIA_CACHE_MAX, onEvict: retire });

/** @param {MediaItem | null | undefined} it */
export const cachedSrc = (it) => it ? it.src || blobs.get(it.key) || null : null;

/** @param {MediaItem} it */
export function forgetSrc(it) {
  const url = blobs.get(it.key);
  if (url && blobs.delete(it.key)) retire(url);
}

/** @param {HTMLImageElement} img @param {MediaItem | null | undefined} it @param {AbortSignal} [parent] */
export async function showSrc(img, it, parent) {
  const scope = createImageScope(img);
  const signal = parent ? AbortSignal.any([parent, scope.signal]) : scope.signal;
  try {
    if (signal.aborted) return;
    const cached = cachedSrc(it);
    const project = !cached && it?.project && it.rel
      ? subscribeProjectImage({ key: it.key, project: it.project, rel: it.rel }, signal)
      : null;
    const read = latest(img, () => {
      if (cached) return null;
      if (!project) throw new Error("No picture");
      return project();
    }, {
      signal,
      commit(blob) {
        if (!blob || !it || !img.isConnected) return;
        const existing = blobs.get(it.key);
        const url = existing ?? URL.createObjectURL(blob);
        img.src = url;
        if (!existing) blobs.set(it.key, url);
      },
    });
    if (cached) img.src = cached;
    await read;
  } catch (err) {
    if (!signal.aborted && !(err instanceof DOMException && err.name === "AbortError")) throw err;
  } finally {
    scope.dispose();
  }
}
