// @ts-check
import { reportFailure } from "./util.js";

/** @typedef {"local" | "session" | Pick<Storage, "getItem" | "setItem">} StorageAccess @typedef {(error: unknown) => void} Report */

/** @param {"local" | "session"} kind */
const browserStore = (kind) => kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;

/** @param {StorageAccess} kind */
const backend = (kind) => typeof kind === "string" ? browserStore(kind) : kind;

/** @param {unknown} error */
const storageUnavailable = (error) => error instanceof DOMException
  && (error.name === "SecurityError" || error.name === "QuotaExceededError");

/** @param {unknown} error */
export function reportStorageFailure(error) {
  if (!storageUnavailable(error)) reportFailure(error);
}

/** @param {Report} report */
export function localStore(report) {
  try { return browserStore("local"); }
  catch (error) { report(error); return undefined; }
}

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

/** @param {string} key @param {"local" | "session" | Pick<Storage, "removeItem">} [kind] @param {Report} [report] */
export function erase(key, kind = "local", report = reportStorageFailure) {
  try {
    const store = typeof kind === "string" ? browserStore(kind) : kind;
    if (!store) return { kept: false };
    store.removeItem(key);
    return { kept: true };
  } catch (error) {
    report(error);
    return { kept: false };
  }
}
