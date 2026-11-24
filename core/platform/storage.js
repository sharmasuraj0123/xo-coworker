// @ts-check

/** @typedef {"local" | "session"} StorageKind */

/** @param {StorageKind} kind */
const backend = (kind) => kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;

/** @template T @param {string} key @param {(raw: string) => T} parse @param {T} fallback @param {StorageKind} [kind] */
export function read(key, parse, fallback, kind = "local") {
  try {
    const raw = backend(kind)?.getItem(key);
    return raw == null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {string} value @param {StorageKind} [kind] */
export function write(key, value, kind = "local") {
  try {
    const store = backend(kind);
    if (!store) return { kept: false };
    store.setItem(key, value);
    return { kept: true };
  } catch {
    return { kept: false };
  }
}
