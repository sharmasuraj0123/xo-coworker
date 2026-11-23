// @ts-check

import { xi } from "../icons/icon.js";

/** @type {Record<string, string>} */
const KEY_IC = { "⌘": "key-command", "⌥": "key-option", "⇧": "key-shift", "⌃": "key-control", "↵": "key-return", "↑": "key-up", "↓": "key-down", "←": "key-left", "→": "key-right" };
/** @type {Record<string, string>} */
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** @param {string} label */
export function keyHtml(label) {
  return String(label).replace(/[&<>"]/g, (char) => ENTITIES[char]).replace(/[⌘⌥⇧⌃↵↑↓←→]/g, (glyph) => xi(KEY_IC[glyph], "kb-ic"));
}
