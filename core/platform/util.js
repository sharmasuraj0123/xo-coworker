// @ts-check

// Small helpers shared by every layer above; none needs the page except space(), which reads 0 without one.

/** @type {Record<string, string>} */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** A spacing token's px from the page (tokens.css --s-1 … --s-12), so script gaps use the stylesheets' scale; 0 in node. @param {string} token */
export function space(token) {
  if (typeof document === "undefined") return 0;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) || 0;
}

/** Escape text for HTML element content AND quoted attribute values. @param {unknown} value */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (c) => ESC[c]);
}

/** Image types the file viewer shows, by suffix (the server's /image route takes the same ones). */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
/** @param {string | null | undefined} path */
export const isImagePath = (path) => IMAGE_EXT.test(String(path || ""));

/** @param {unknown} error */
export function reportFailure(error) {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
}
