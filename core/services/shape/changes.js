// @ts-check

import { isObj } from "./model.js";

/** @typedef {{ path: string[], value?: any, gone?: boolean }} Change */

// One person's change, and putting it back on top of another device's.

/** A value with its keys sorted, so two documents that say the same compare equal. @param {any} v @returns {any} */
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
/** Do two documents say the same? (key order aside; null and missing are both "none") @param {any} a @param {any} b */
export const sameDoc = (a, b) => JSON.stringify(sorted(a ?? null)) === JSON.stringify(sorted(b ?? null));
/** @param {any} v @returns {any} */
export const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** What changed from a to b, down to the leaves: {path, value} for a key set, {path, gone: true} for one taken out; an object on either side is compared key by key, a list or a value is one change, and null as a value is kept (in mine: "not what the layer below says"). @param {any} a @param {any} b @param {string[]} [path] @returns {Change[]} */
export function changesOf(a, b, path = []) {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {};
  /** @type {Change[]} */
  const out = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const p = [...path, k], had = Object.hasOwn(A, k), has = Object.hasOwn(B, k);
    if ((isObj(A[k]) || !had) && (isObj(B[k]) || !has) && (isObj(A[k]) || isObj(B[k]))) out.push(...changesOf(A[k], B[k], p));
    else if (!has) out.push({ path: p, gone: true });
    else if (!had || !sameDoc(A[k], B[k])) out.push({ path: p, value: copy(B[k]) });
  }
  return out;
}

/** A document with changes made on top of it, in order (a new document; an object emptied by a removal goes too). @param {any} doc @param {Change[] | null | undefined} changes @returns {any} */
export function applyChanges(doc, changes) {
  const out = isObj(doc) ? copy(doc) : {};
  for (const c of changes || []) {
    const keys = c.path, last = keys[keys.length - 1];
    if (c.gone) {
      /** @type {[any, string][]} */
      const trail = [];
      let o = out;
      for (const k of keys.slice(0, -1)) { if (!isObj(o[k])) { o = null; break; } trail.push([o, k]); o = o[k]; }
      if (!o) continue;
      delete o[last];
      for (const [parent, k] of trail.reverse()) { if (Object.keys(parent[k]).length) break; delete parent[k]; }
      continue;
    }
    let o = out;
    for (const k of keys.slice(0, -1)) { if (!isObj(o[k])) o[k] = {}; o = o[k]; }
    o[last] = copy(c.value);
  }
  return out;
}

/** Is this one clear change, a single key (however often it was set)? Only that is put back over another device's. @param {Change[] | null | undefined} changes */
export const oneKey = (changes) => new Set((changes || []).map((c) => JSON.stringify(c.path))).size === 1;
