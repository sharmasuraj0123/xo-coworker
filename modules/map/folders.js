// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { latest } from "../../core/platform/latest.js";
import { directoryResult } from "./read-directory.js";
/** @import { Directory, MapFolder, TreeReader } from "./folders-types.d.ts" */

/** @param {MapFolder} fold @param {string} local */
export const apiRel = (fold, local) => (fold.base ? (local ? `${fold.base}/${local}` : fold.base) : local);

/** @param {MapFolder} fold @param {string} local */
const dirKey = (fold, local) => JSON.stringify([fold.project, fold.base || "", local]);

/** @param {TreeReader} api @param {() => void} paint @param {ReturnType<typeof createScope>} [scope] */
export function createMapFolders(api, paint, scope = createScope()) {
  /** @type {Map<string, Directory>} */
  const dirs = new Map();
  const { signal, dispose } = scope;
  scope.effect(() => () => dirs.clear());

  /** @param {MapFolder} fold @param {string} local */
  async function load(fold, local, { again = false } = {}) {
    if (signal.aborted) return;
    const k = dirKey(fold, local);
    const had = dirs.get(k);
    if (had && (had.state === "loading" || ((had.state === "ok" || had.state === "error") && !again))) return;
    const previous = had?.state === "ok" ? had : had?.state === "error" ? had.previous : undefined;
    const entry = previous && had ? had : { state: /** @type {const} */ ("loading") };
    dirs.set(k, entry);
    const result = await latest(entry, (readSignal) => directoryResult(api, fold, apiRel(fold, local), readSignal), {
      signal,
      commit({ directory }) {
        dirs.set(k, directory.state === "error" && previous ? { ...directory, previous } : directory);
        paint();
      },
    }).catch((error) => { if (error?.name !== "AbortError") throw error; });
    if (result?.failure) throw result.failure.error;
  }
  return { load, dispose, get: (/** @type {MapFolder} */ fold, /** @type {string} */ local) => dirs.get(dirKey(fold, local)) };
}
