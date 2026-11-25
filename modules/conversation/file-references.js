// @ts-check

/** @typedef {{ path: string; name?: string } & ({ a: number; b: number } | { a: null; b: null })} FileReference */

export function createFileReferences() {
  /** @type {Map<string, FileReference>} */
  const references = new Map();
  return {
    get: references.get.bind(references),
    /** @param {string} view @param {FileReference} reference */
    set(view, reference) { references.set(view, reference); },
    remove: references.delete.bind(references),
  };
}

export const FILE_MARK = "File: ";
/** @param {string | null | undefined} text */
export function fileRef(text) {
  const m = /^File: ([^\n]+)\n\n([\s\S]+)$/.exec(String(text || ""));
  return m && m[1].trim() ? { path: m[1].trim(), rest: m[2] } : null;
}
/** @param {string | null | undefined} text */
export function lineRef(text) {
  const m = /^([^\s:]+\.[^\s:]*|[^\s:]*\/[^\s:]+|[A-Za-z][\w.-]*):(\d+)(?:-(\d+))?\n\n([\s\S]*)$/.exec(String(text || ""));
  if (!m) return null;
  const a = +m[2], b = m[3] ? +m[3] : a;
  return a > 0 && b >= a ? { path: m[1], a, b, rest: m[4] } : null;
}
