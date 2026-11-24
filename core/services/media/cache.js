// @ts-check

import { createLru } from "../../platform/cache.js";

export const MEDIA_CACHE_MAX = 200;

/** @type {ReturnType<typeof createLru<string, true>>} */
const failedWebSources = createLru({ max: MEDIA_CACHE_MAX });

/** @param {unknown} url */
export const webGone = (url) => failedWebSources.get(String(url)) === true;

/** @param {unknown} url */
export function markWebGone(url) {
  failedWebSources.set(String(url), true);
}
