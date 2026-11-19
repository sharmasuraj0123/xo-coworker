// @ts-check

// Unsaved edits, kept in this browser until ⌘S saves them (js/viewer.js).

/** @import { Store, Draft } from "./types.d.ts" */

const INDEX = "xo-drafts", ONE = "xo-draft:", MAX = 20, MAX_BYTES = 2 * 1024 * 1024;

export const draftKey = (/** @type {string} */ project, /** @type {string} */ rel) => `${project}|${rel}`;

/** @param {Store} store @returns {Record<string, number>} */
function index(store) {
  try { const a = JSON.parse(store.getItem(INDEX) || "{}"); return a && typeof a === "object" && !Array.isArray(a) ? a : {}; } catch { return {}; }
}
const set = (/** @type {Store} */ store, /** @type {string} */ k, /** @type {string} */ v) => { try { store.setItem(k, v); return true; } catch { return false; } };
const rm = (/** @type {Store} */ store, /** @type {string} */ k) => { try { store.removeItem(k); } catch { /* refused: nothing to drop */ } };
/** @param {Store} store @param {Record<string, number>} a */
function putIndex(store, a) {
  if (Object.keys(a).length) return set(store, INDEX, JSON.stringify(a));
  rm(store, INDEX);
  return true;
}

/** The draft kept for a file, or null. @param {Store | null} store @param {string | null} key @returns {Draft | null} */
export function getDraft(store, key) {
  if (!store || !key) return null;
  try {
    const d = JSON.parse(store.getItem(ONE + key) || "null");
    return d && typeof d.text === "string" && typeof d.base === "string" ? d : null;
  } catch { return null; }
}

/** Keep a draft. False when it can't be kept (too big, storage full or refused). @param {Store | null} store @param {string | null} key @param {{ text: string, base: string, version?: string | null, at?: number }} d */
export function putDraft(store, key, { text, base, version, at = Date.now() }) {
  if (!store || !key || typeof text !== "string" || typeof base !== "string") return false;
  if ((text.length + base.length) * 2 > MAX_BYTES) return false;
  const a = index(store);
  delete a[key];
  const old = Object.keys(a).sort((x, y) => (a[y] || 0) - (a[x] || 0)); // newest first
  const drop = (/** @type {string} */ k) => { rm(store, ONE + k); delete a[k]; };
  for (const k of old.splice(MAX - 1)) drop(k);
  const v = JSON.stringify({ text, base, version: version ?? null, at });
  // storage full: older drafts make room for this one, the oldest first
  while (!set(store, ONE + key, v)) {
    if (!old.length) { putIndex(store, a); return false; }
    drop(/** @type {string} */ (old.pop()));
  }
  a[key] = at;
  if (putIndex(store, a)) return true;
  rm(store, ONE + key);
  return false;
}

/** Let a draft go (saved, discarded, or the same as the file again). @param {Store | null} store @param {string | null} key */
export function dropDraft(store, key) {
  if (!store || !key) return;
  rm(store, ONE + key);
  const a = index(store);
  if (key in a) { delete a[key]; putIndex(store, a); }
}
