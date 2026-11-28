// @ts-check

import { usable } from "./a11y/focus.js";

const LANDING = 'button:not(:disabled), a[href], input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [tabindex="0"]';
/** @param {HTMLElement} box @param {HTMLElement} row @param {Element | null} before */
function moveRow(box, row, before) {
  if (row.parentElement === box && row.isConnected && typeof box.moveBefore === "function") {
    box.moveBefore(row, before);
    return;
  }
  box.insertBefore(row, before);
}

/** @type {WeakMap<HTMLElement, string>} */
const rowMarkup = new WeakMap();
/** @import {ReconcileOptions, Row, Redraw} from "./redraw-types.d.ts" */

/** @param {Redraw} redraw @param {HTMLElement} box @param {Row[]} items @param {ReconcileOptions} [opts] */
export function reconcileRows(redraw, box, items, { quiet = false, fallback = null } = {}) {
  /** @type {Map<string, HTMLElement>} */
  const old = new Map();
  /** @type {{ added: HTMLElement[], inPlace: HTMLElement[] }} */
  const { added, inPlace } = { added: [], inPlace: [] };
  const tpl = document.createElement("template");
  const active = document.activeElement;
  const keep = new Set(items.map((it) => it.key));
  const rows = /** @type {HTMLElement[]} */ ([...box.children]);
  for (const el of rows) if (el.dataset.k) old.set(el.dataset.k, el);
  const going = rows.find((el) => el.dataset.k && !keep.has(el.dataset.k) && el.contains(active));
  let near = /** @type {string | undefined} */ (undefined);
  if (going) {
    const i = rows.indexOf(going);
    const ordered = [...rows.slice(0, i).reverse(), ...rows.slice(i + 1)];
    near = ordered.find((row) => row.dataset.k && keep.has(row.dataset.k))?.dataset.k;
  }
  items.forEach((it, i) => {
    let el = old.get(it.key);
    if (el && rowMarkup.get(el) !== it.html) {
      tpl.innerHTML = it.html.trim();
      const fresh = /** @type {HTMLElement | null} */ (tpl.content.firstElementChild);
      if (!fresh) throw new TypeError("A list row needs an element");
      if (fresh.tagName === el.tagName) {
        for (const a of [...el.attributes]) if (a.name !== "data-k" && !fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
        for (const a of fresh.attributes) if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value);
        redraw(el, fresh.innerHTML);
        rowMarkup.set(el, it.html);
        inPlace.push(el);
      } else {
        fresh.dataset.k = it.key; rowMarkup.set(fresh, it.html);
        const had = el === active;
        el.replaceWith(fresh); el = fresh;
        if (had && fresh.tabIndex >= 0) fresh.focus({ preventScroll: true });
      }
    } else if (!el) {
      tpl.innerHTML = it.html.trim();
      el = /** @type {HTMLElement | null} */ (tpl.content.firstElementChild) || undefined;
      if (!el) throw new TypeError("A list row needs an element");
      el.dataset.k = it.key; rowMarkup.set(el, it.html);
      if (!quiet) { el.classList.add("is-new"); added.push(el); }
    }
    old.delete(it.key);
    const at = box.children[i];
    if (at !== el) moveRow(box, el, at || null);
  });
  if (going) {
    const row = near && [...box.children].find((el) => el.getAttribute("data-k") === near);
    const to = row && [...row.querySelectorAll(LANDING)].find(usable) || fallback?.();
    if (to instanceof HTMLElement) to.focus({ preventScroll: true });
  }
  for (const el of old.values()) el.remove();
  for (const el of inPlace) if (el.isConnected) el.dispatchEvent(new CustomEvent("redrawn", { bubbles: true }));
  return added;
}
