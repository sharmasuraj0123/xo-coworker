// @ts-check

/** @param {Pick<import("./store.js").Changes, "saved">} CHG */
export function createSavedSoon(CHG) {
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const savedT = new Map();
  /** @param {{ project: string, rel: string }} f */
  return function savedSoon(f) {
    const k = `${f.project}|${f.rel}`;
    clearTimeout(savedT.get(k));
    savedT.set(k, setTimeout(() => { savedT.delete(k); CHG.saved(f.project, f.rel); }, 2500));
  };
}
