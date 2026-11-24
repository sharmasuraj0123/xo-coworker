// @ts-check

/** @template K, V @param {{ max: number, onEvict?: (value: V, key: K) => void }} options */
export function createLru({ max, onEvict }) {
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError("Cache capacity must be a positive integer");
  /** @type {Map<K, { value: V }>} */
  const entries = new Map();
  return {
    /** @param {K} key */
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    /** @param {K} key @param {V} value */
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value });
      if (entries.size <= max) return;
      const oldest = entries.entries().next();
      if (oldest.done) return;
      const [oldKey, entry] = oldest.value;
      entries.delete(oldKey);
      onEvict?.(entry.value, oldKey);
    },
    has: entries.has.bind(entries),
    delete: entries.delete.bind(entries),
    clear: entries.clear.bind(entries),
    get size() { return entries.size; },
  };
}
