// @ts-check
import { ApiError } from "../../core/platform/http.js";
/** @import { MapFolder, TreeEntry, TreeReader } from "./folders-types.d.ts" */

const READ_FAILED = "Couldn't read it";

/** @param {TreeReader} api @param {MapFolder} fold @param {string} relative @param {AbortSignal} signal */
async function readDirectory(api, fold, relative, signal) {
  const prefix = fold.base ? fold.base + "/" : "";
  /** @param {TreeEntry} entry */
  const strip = (entry) => {
    const path = String(entry.relative_path || entry.name);
    return { name: entry.name, path: prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path };
  };
  let tree;
  try { tree = await api.projectTree(fold.project, relative, signal); }
  catch (error) {
    signal.throwIfAborted();
    if (!(error instanceof ApiError)) throw error;
    return { state: /** @type {const} */ ("error"), error: error.status === 404 ? "Not there any more" : READ_FAILED };
  }
  return { state: /** @type {const} */ ("ok"), dirs: (tree.dirs || []).map(strip), files: (tree.files || []).map(strip) };
}

/** @param {TreeReader} api @param {MapFolder} fold @param {string} relative @param {AbortSignal} signal */
export async function directoryResult(api, fold, relative, signal) {
  try { return { directory: await readDirectory(api, fold, relative, signal) }; }
  catch (error) {
    signal.throwIfAborted();
    return { directory: { state: /** @type {const} */ ("error"), error: READ_FAILED }, failure: { error } };
  }
}
