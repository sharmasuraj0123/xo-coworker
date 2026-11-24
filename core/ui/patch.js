// @ts-check

import { redraw } from "./redraw.js";

/** @param {Element & { _h?: string }} el @param {string} html */
export function patch(el, html) {
  if (el._h === html) return false;
  const a = /** @type {HTMLElement | null} */ (document.activeElement);
  let sel = null;
  if (a && a !== el && el.contains(a)) {
    if (a.dataset.fid) sel = `[data-fid="${CSS.escape(a.dataset.fid)}"]`;
    else if (a.id) sel = `#${CSS.escape(a.id)}`;
    else { const d = [...a.attributes].filter((x) => x.name.startsWith("data-")); if (d.length) sel = a.tagName.toLowerCase() + d.map((x) => (x.value ? `[${x.name}="${CSS.escape(x.value)}"]` : `[${x.name}]`)).join(""); }
  }
  redraw(el, html); el._h = html;
  if (sel && !(/** @type {HTMLElement} */ (a)).isConnected) (/** @type {HTMLElement | null} */ (el.querySelector(sel)))?.focus({ preventScroll: true });
  return true;
}
