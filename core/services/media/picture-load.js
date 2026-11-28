// @ts-check

import { fadeImage } from "../../ui/motion.js";
import { createImageScope } from "./image-scope.js";
import { showSrc } from "./images.js";
import { watchNear } from "./intersection.js";

const SLOW_MS = 3000;

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** @type {WeakMap<HTMLImageElement, ReturnType<typeof createImageScope>>} */
const loads = new WeakMap();

/** @param {HTMLImageElement} img @param {MediaItem | null} item @param {{ near: boolean, ready: () => void, failed: () => void, slow: () => void, removed: () => void }} options */
export function loadPicture(img, item, { near, ready, failed, slow, removed }) {
  loads.get(img)?.dispose();
  const scope = createImageScope(img);
  const complete = () => img.complete && img.naturalWidth > 0;
  if (scope.signal.aborted) { removed(); return; }
  if (complete()) { scope.dispose(); ready(); return; }
  loads.set(img, scope);
  scope.effect(() => () => {
    loads.delete(img);
    if (!img.isConnected) removed();
  });
  const finish = (/** @type {() => void} */ done) => {
    if (scope.signal.aborted || !img.isConnected) return;
    scope.dispose();
    done();
  };
  fadeImage(img);
  scope.listen(img, "load", () => finish(ready));
  scope.listen(img, "error", () => finish(failed));

  function start() {
    if (scope.signal.aborted) return;
    if (complete()) { finish(ready); return; }
    scope.timeout(() => { if (!complete()) slow(); }, SLOW_MS);
    if (!img.hasAttribute("src")) showSrc(img, item, scope.signal).catch(() => finish(failed));
  }
  if (near) watchNear(img, start, scope);
  else start();
}
