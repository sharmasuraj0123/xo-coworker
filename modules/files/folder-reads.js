// @ts-check

import { api } from "../../core/platform/api.js";

/** @import { FilesScope } from "./scope.js" */

/** @typedef {{name: string, relative_path?: string | null, size_bytes?: number | null, modified_at: string}} TreeEntry */

/** @typedef {{name: string, path: string, bytes: number | null, at: number}} FileRow */

/** @typedef {{state: "loading" | "ok" | "error", v: number, retry?: boolean, error?: string, dirs?: FileRow[], files?: FileRow[]}} FolderRead */

export const apiRel = (/** @type {FilesScope} */ s, /** @type {string} */ local) => (s.base ? (local ? `${s.base}/${local}` : s.base) : local);
export const dkey = (/** @type {FilesScope} */ s, /** @type {string} */ local) => `${s.project}|${apiRel(s, local)}`;

/** @param {() => void} paint */
export function createFolderReads(paint) {
  /** @type {Map<string, FolderRead>} */
  const dirs = new Map();
  let VER = 0;

  async function load(/** @type {FilesScope} */ s, /** @type {string} */ local, { again = false } = {}) {
    const k = dkey(s, local);
    const had = dirs.get(k);
    if (had && (had.state === "loading" || (had.state === "ok" && !again))) return had;
    // a Try again reads with its note still there, saying it's reading again (its button stays, busy)
    dirs.set(k, { ...(had || {}), state: had && had.state === "ok" ? "ok" : "loading", retry: !!(had && had.state === "error"), v: ++VER });
    try {
      const d = await api.projectTree(/** @type {string} */ (s.project), apiRel(s, local));
      const strip = (/** @type {TreeEntry} */ e) => { let p = String(e.relative_path || e.name); if (s.base && p.startsWith(s.base + "/")) p = p.slice(s.base.length + 1); return { name: e.name, path: p, bytes: e.size_bytes ?? null, at: Date.parse(e.modified_at) || 0 }; };
      dirs.set(k, { state: "ok", dirs: (d.dirs || []).map(strip), files: (d.files || []).map(strip), v: ++VER });
    } catch (err) {
      dirs.set(k, { state: "error", error: /** @type {{status?: number}} */ (err).status === 404 ? "Not there any more" : "Couldn't read it", v: ++VER });
    }
    paint();
    return dirs.get(k);
  }

  return { dirs, load };
}
