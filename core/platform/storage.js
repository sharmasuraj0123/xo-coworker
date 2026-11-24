// @ts-check

/** @typedef {"local" | "session" | Pick<Storage, "getItem" | "setItem">} StorageAccess */

/** @param {StorageAccess} kind */
const backend = (kind) => kind === "session" ? globalThis.sessionStorage : kind === "local" ? globalThis.localStorage : kind;

/** @template T @param {string} key @param {(raw: string) => T} parse @param {T} fallback @param {StorageAccess} [kind] */
export function read(key, parse, fallback, kind = "local") {
  try {
    const raw = backend(kind)?.getItem(key);
    return raw == null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {string} value @param {StorageAccess} [kind] */
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

/** @param {string} key @param {"local" | "session"} [kind] */
export function erase(key, kind = "local") {
  try {
    const store = kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;
    store.removeItem(key);
    return { kept: true };
  } catch {
    return { kept: false };
  }
}
