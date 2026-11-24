// @ts-check

export function createDockFolds() {
  /** @type {Set<string>} */
  const folded = new Set();
  return { isFolded: folded.has.bind(folded), fold: folded.add.bind(folded), unfold: folded.delete.bind(folded) };
}
