// @ts-check

/** @typedef {{ numbers: Map<string, number>, defs: Map<string, number>, refs: Map<string, number> }} Notes */

export const NOTE_REF = /\[\^([^\]\s]+)\](?!:)/g;
export const NOTE_DEF = /^\[\^([^\]\s]+)\]:[ \t]?/;
const DEFS = new RegExp(NOTE_DEF.source, "gm");

/** Footnotes numbered as the text first cites them, with each one's definition and first citation. @param {string} text @returns {Notes} */
export function notesOf(text) {
  /** @type {Notes} */
  const notes = { numbers: new Map(), defs: new Map(), refs: new Map() };
  if (!text.includes("[^")) return notes;
  for (const m of text.matchAll(DEFS)) if (!notes.defs.has(m[1])) notes.defs.set(m[1], m.index);
  for (const m of text.matchAll(NOTE_REF)) {
    if (notes.refs.has(m[1])) continue;
    notes.refs.set(m[1], m.index);
    notes.numbers.set(m[1], notes.numbers.size + 1);
  }
  for (const id of notes.defs.keys()) if (!notes.numbers.has(id)) notes.numbers.set(id, notes.numbers.size + 1);
  return notes;
}
