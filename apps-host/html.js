// @ts-check

/** @type {Record<string, string>} */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** Escape text for element content and quoted attribute values. @param {unknown} value */
export const esc = (value) => String(value ?? "").replace(/[&<>"'`]/g, (c) => ESC[c]);
