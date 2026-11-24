// @ts-check
import { ApiError } from "../../core/platform/http.js";
/** @import { Directory, MapFolder, TreeEntry, TreeReader } from "./folders-types.d.ts" */

/** @param {TreeReader} api @param {MapFolder} fold @param {string} relative @param {AbortSignal} signal @returns {Promise<Directory>} */
export async function readDirectory(api, fold, relative, signal) {
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
    return { state: "error", error: error.status === 404 ? "Not there any more" : "Couldn't read it" };
  }
  return { state: "ok", dirs: (tree.dirs || []).map(strip), files: (tree.files || []).map(strip) };
}
