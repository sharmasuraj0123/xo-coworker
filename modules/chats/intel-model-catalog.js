// @ts-check
import { api } from "../../core/platform/api.js";
import { createLru } from "../../core/platform/cache.js";
import { once } from "../../core/platform/pending.js";

const MAX_RUNTIME_CATALOGS = 64;

/** @typedef {import("./intel-types").IntelModel} Model */

/** @param {() => readonly import("./intel-types").IntelRuntime[]} runtimes */
export function createModelCatalog(runtimes) {
  /** @type {ReturnType<typeof createLru<string | null, Model[]>>} */
  const cache = createLru({ max: MAX_RUNTIME_CATALOGS });
  const models = {
    get: cache.get,
    has: cache.has,
    values: () => runtimes().flatMap(({ name }) => {
      const catalog = cache.get(name);
      return catalog ? [catalog] : [];
    }),
  };
  /** @type {Map<string, symbol>} */
  const requestKeys = new Map();

  /** @param {string | null} name @param {{ fresh?: boolean, signal: AbortSignal }} options */
  async function read(name, { fresh = false, signal }) {
    if (!name) return [];
    const cached = models.get(name);
    if (cached && !fresh) return cached;
    const key = requestKeys.get(name) ?? Symbol(name);
    requestKeys.set(name, key);
    for (;;) {
      signal.throwIfAborted();
      const items = await once(key, async () => {
        if (signal.aborted) return null;
        try {
          const data = await api.models(name, { signal });
          if (signal.aborted) return null;
          const entries = data.models || [];
          if (runtimes().some((runtime) => runtime.name === name)) cache.set(name, entries);
          return entries;
        } catch (error) {
          if (signal.aborted) return null;
          throw error;
        }
      });
      signal.throwIfAborted();
      if (items) return items;
    }
  }

  /** @param {string} name @param {AbortSignal} signal */
  const warm = (name, signal) => runtimes().some((runtime) => runtime.name === name) ? read(name, { signal }) : Promise.resolve([]);

  return { models, read, warm };
}
