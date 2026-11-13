// Unsaved edits, kept in this browser (Files › Edit, js/viewer.js). A file you were editing when you left it
// (another place, another file, a reload, a closed tab) opens again with your edits waiting: "Your draft ·
// Continue". Each is {text, base (the file as it was when you started), version (Space's, to save against),
// at}, by project and path, in localStorage: one entry per file ("xo-draft:<project>|<path>"), so keeping
// one writes only that one, and an index of them ("xo-drafts", {key: at}). At most 20 (the oldest go, and
// make room when the storage is full), none over 2 MB: a bigger one isn't kept, and leaving that file asks
// first, as before. Written after a pause in typing, never on a keystroke. Pure: `store` is localStorage or
// a stand-in.

const INDEX = "xo-drafts", ONE = "xo-draft:", MAX = 20, MAX_BYTES = 2 * 1024 * 1024;

export const draftKey = (project, rel) => `${project}|${rel}`;

function index(store) {
  try { const a = JSON.parse(store.getItem(INDEX) || "{}"); return a && typeof a === "object" && !Array.isArray(a) ? a : {}; } catch { return {}; }
}
const set = (store, k, v) => { try { store.setItem(k, v); return true; } catch { return false; } };
const rm = (store, k) => { try { store.removeItem(k); } catch {} };
function putIndex(store, a) {
  if (Object.keys(a).length) return set(store, INDEX, JSON.stringify(a));
  rm(store, INDEX);
  return true;
}

/** The draft kept for a file, or null. */
export function getDraft(store, key) {
  if (!store || !key) return null;
  try {
    const d = JSON.parse(store.getItem(ONE + key) || "null");
    return d && typeof d.text === "string" && typeof d.base === "string" ? d : null;
  } catch { return null; }
}

/** Keep a draft. False when it can't be kept (too big, storage full or refused). */
export function putDraft(store, key, { text, base, version, at = Date.now() }) {
  if (!store || !key || typeof text !== "string" || typeof base !== "string") return false;
  if ((text.length + base.length) * 2 > MAX_BYTES) return false;
  const a = index(store);
  delete a[key];
  const old = Object.keys(a).sort((x, y) => (a[y] || 0) - (a[x] || 0)); // newest first
  const drop = (k) => { rm(store, ONE + k); delete a[k]; };
  for (const k of old.splice(MAX - 1)) drop(k);
  const v = JSON.stringify({ text, base, version: version ?? null, at });
  // storage full: older drafts make room for this one, the oldest first
  while (!set(store, ONE + key, v)) {
    if (!old.length) { putIndex(store, a); return false; }
    drop(old.pop());
  }
  a[key] = at;
  if (putIndex(store, a)) return true;
  rm(store, ONE + key);
  return false;
}

/** Let a draft go (saved, discarded, or the same as the file again). */
export function dropDraft(store, key) {
  if (!store || !key) return;
  rm(store, ONE + key);
  const a = index(store);
  if (key in a) { delete a[key]; putIndex(store, a); }
}
