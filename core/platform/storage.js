// @ts-check

/** @typedef {"local" | "session" | Pick<Storage, "getItem" | "setItem">} StorageAccess @typedef {(error: unknown) => void} Report */

/** @param {StorageAccess} kind */
const backend = (kind) => kind === "session" ? globalThis.sessionStorage : kind === "local" ? globalThis.localStorage : kind;

/** @template T @param {string} key @param {(s:string)=>T} parse @param {T} backup @param {StorageAccess} [kind] @param {Report} [report] */
export function read(key, parse, backup, kind = "local", report) {
  try {
    const raw = backend(kind)?.getItem(key);
    return raw == null ? backup : parse(raw);
  } catch (error) {
    report?.(error);
    return backup;
  }
}

/** @param {string} key @param {string} value @param {StorageAccess} [kind] @param {Report} [report] */
export function write(key, value, kind = "local", report) {
  try {
    const store = backend(kind);
    if (!store) return { kept: false };
    store.setItem(key, value);
    return { kept: true };
  } catch (error) {
    report?.(error);
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
