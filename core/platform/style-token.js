// @ts-check

/** @type {WeakMap<Document, CSSStyleDeclaration>} */
const roots = new WeakMap();

/** @param {string} name */
export function rootToken(name) {
  const doc = globalThis.document;
  if (!doc?.documentElement || typeof getComputedStyle !== "function") return "";
  let style = roots.get(doc);
  if (!style) { style = getComputedStyle(doc.documentElement); roots.set(doc, style); }
  return style.getPropertyValue(name).trim();
}
