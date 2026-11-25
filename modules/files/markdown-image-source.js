// @ts-check

import { api } from "../../core/platform/api.js";
import { createLru } from "../../core/platform/cache.js";
import { once } from "../../core/platform/pending.js";
import { resolveImage } from "./markdown-figures.js";

/** @import {ImageSource} from "./markdown-figures.js" */

/** @import {createScope} from "../../core/kernel/scope.js" */

const KEPT = 32;
let sources = 0;

/** @typedef {ReturnType<typeof createScope>} Scope */

/** A document's pictures as object URLs while the scope lives. @param {string} project @param {string} rel @param {Scope} scope */
export function projectImages(project, rel, scope) {
  const { signal } = scope;
  const id = ++sources;
  /** @type {Set<string>} */
  const live = new Set();
  /** @type {ReturnType<typeof createLru<string, string>>} */
  const urls = createLru({ max: KEPT, onEvict: revoke });

  /** @param {string} url */
  function revoke(url) { live.delete(url); URL.revokeObjectURL(url); }
  scope.effect(() => () => { for (const url of [...live]) revoke(url); urls.clear(); });
  /** @type {ImageSource} */
  const source = async (src) => {
    const path = resolveImage(rel, src);
    if (!path) return null;
    const known = urls.get(path);
    if (known) return known;
    return once(`md-image:${id}:${path}`, async () => {
      let picture;
      try { picture = await api.projectImage(project, path, { signal }); }
      catch (error) {
        const status = /** @type {{status?: number}} */ (error).status;
        if (status === 404 || status === 403 || status === 415) return null;
        throw error;
      }
      if (signal.aborted) return null;
      const url = URL.createObjectURL(picture);
      live.add(url);
      urls.set(path, url);
      return url;
    });
  };
  return source;
}
