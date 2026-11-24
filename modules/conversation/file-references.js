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
