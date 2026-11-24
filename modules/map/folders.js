// @ts-check

/** @import { Directory, MapFolder, TreeEntry, TreeReader } from "./folders-types.d.ts" */

/** @param {MapFolder} fold @param {string} local */
export const apiRel = (fold, local) => (fold.base ? (local ? `${fold.base}/${local}` : fold.base) : local);

/** @param {MapFolder} fold @param {string} local */
const dirKey = (fold, local) => `${fold.project}|${apiRel(fold, local)}`;

/** @param {TreeReader} api @param {() => void} paint */
export function createMapFolders(api, paint) {
  /** @type {Map<string, Directory>} */
  const dirs = new Map();

  /** @param {MapFolder} fold @param {string} local */
  async function load(fold, local, { again = false } = {}) {
    const k = dirKey(fold, local);
    const had = dirs.get(k);
    if (had && (had.state === "loading" || ((had.state === "ok" || had.state === "error") && !again))) return;
    dirs.set(k, /** @type {Directory} */ ({ ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading" }));
    try {
      const d = await api.projectTree(fold.project, apiRel(fold, local));
      /** @param {TreeEntry} e */
      const strip = (e) => {
        let p = String(e.relative_path || e.name);
        if (fold.base && p.startsWith(fold.base + "/")) p = p.slice(fold.base.length + 1);
        return { name: e.name, path: p };
      };
      dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip) });
    } catch (err) {
      dirs.set(k, { state: "error", error: /** @type {{ status?: number }} */ (err).status === 404 ? "Not there any more" : "Couldn't read it" });
    }
    paint();
  }

  return { load, get: (/** @type {MapFolder} */ fold, /** @type {string} */ local) => dirs.get(dirKey(fold, local)) };
}
