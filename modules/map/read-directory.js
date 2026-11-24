// @ts-check

/** @import { Directory, MapFolder, TreeEntry, TreeReader } from "./folders-types.d.ts" */

/** @param {TreeReader} api @param {MapFolder} fold @param {string} relative @param {AbortSignal} signal @returns {Promise<Directory>} */
export async function readDirectory(api, fold, relative, signal) {
  const prefix = fold.base ? fold.base + "/" : "";
  /** @param {TreeEntry} entry */
  const strip = (entry) => {
    const path = String(entry.relative_path || entry.name);
    return { name: entry.name, path: prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path };
  };
  try {
    const tree = await api.projectTree(fold.project, relative, signal);
    return { state: "ok", dirs: (tree.dirs || []).map(strip), files: (tree.files || []).map(strip) };
  } catch (error) {
    signal.throwIfAborted();
    const status = /** @type {{ status?: number } | null} */ (error)?.status;
    return { state: "error", error: status === 404 ? "Not there any more" : "Couldn't read it" };
  }
}
