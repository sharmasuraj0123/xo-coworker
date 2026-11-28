// @ts-check

// Brings a region's DOM to new HTML in place, keyed by id, data-key or data- hooks, so focus, caret and a press survive.

import { inSight, bringWhole, hookOf } from "./a11y/focus.js";
import { pressedNode } from "./press.js";
import { reconcileRows } from "./reconcile.js";
export { pressedNode } from "./press.js";
export const reconcile = reconcileRows.bind(null, redraw);

/** @param {Element | null | undefined} el @param {string} html @param {import("./redraw-types.d.ts").RedrawOptions} [options] */
export function redraw(el, html, { preserve } = {}) {
  if (!el) return false;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const focus = deepActive();
  const seen = !!focus && el.contains(focus) && inSight(focus);
  const recover = focus && el.contains(focus) && focus !== el ? focusSelector(focus) : null;
  const changed = syncChildren(el, tpl.content, focus, [focus, pressedNode()], preserve && ((node) => own(node) || preserve(node)));
  if (focus?.isConnected) {
    if (changed && seen && !inSight(focus)) bringWhole(focus);
  } else if (recover) (/** @type {HTMLElement | null} */ (el.querySelector(recover)))?.focus({ preventScroll: true });
  return changed;
}

/** @param {Element} node */
function focusSelector(node) {
  const fid = node.getAttribute("data-fid");
  return fid ? `[data-fid="${CSS.escape(fid)}"]` : hookOf(node);
}

/** Brings node itself to the one element html draws, in place when tag and key match, else replaced; returns the node now in the page. @param {Element} node @param {string} html */
export function redrawNode(node, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  const want = tpl.content.firstElementChild;
  if (!want) return node;
  if (!same(node, want)) { node.replaceWith(want); return want; }
  const focus = deepActive();
  syncNode(node, want, focus, [focus, pressedNode()].filter(Boolean));
  return node;
}

const VOLATILE = /^data-(inv|inv-now)$/;
/** @returns {Element | null} */
function deepActive() { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; }
/** @param {Node} n */
function keyOf(n) {
  if (!(n instanceof Element)) return null;
  if (n.id) return "#" + n.id;
  const k = n.getAttribute("data-key");
  if (k != null) return "k:" + k;
  let hooks = "";
  for (const a of n.attributes) if (a.name.startsWith("data-") && !VOLATILE.test(a.name)) hooks += `[${a.name}=${a.value}]`;
  return hooks || null;
}
/** @param {Node} a @param {Node} b */
const same = (a, b) => a.nodeType === b.nodeType && (!(a instanceof Element) ||
  (b instanceof Element && a.tagName === b.tagName && keyOf(a) === keyOf(b)));
/** @param {Node} n */
const own = (n) => n instanceof Element && n.hasAttribute("data-own");
/** @param {Node} from @param {Node} to @param {Element | null} focus @param {(Node | null)[]} hold */
function syncChildren(from, to, focus, hold, skip = own) {
  let changed = false;
  let cur = from.firstChild;
  while (cur && skip(cur)) cur = cur.nextSibling;
  for (const want of [...to.childNodes]) {
    let match = null;
    for (let c = cur; c; c = c.nextSibling) if (!skip(c) && same(c, want)) { match = c; break; }
    if (match) {
      // one holding focus or a press isn't moved: what's in between moves instead
      if (match !== cur) {
        if (hold.some((h) => match.contains(h))) {
          while (cur && cur !== match) {
            const next = cur.nextSibling;
            if (!skip(cur)) from.appendChild(cur);
            cur = next;
          }
        } else from.insertBefore(match, cur);
        changed = true;
      }
      if (syncNode(match, want, focus, hold)) changed = true;
      cur = match.nextSibling;
    } else {
      from.insertBefore(want, cur);
      changed = true;
    }
  }
  while (cur) { const next = cur.nextSibling; if (!skip(cur)) { from.removeChild(cur); changed = true; } cur = next; }
  return changed;
}

/** @param {Node} node @param {Node} want @param {Element | null} focus @param {(Node | null)[]} hold @returns {boolean} */
function syncNode(node, want, focus, hold) {
  if (node.nodeType === 3 || node.nodeType === 8) {
    if (node.textContent !== want.textContent) { node.textContent = want.textContent; return true; }
    return false;
  }
  if (!(node instanceof Element) || !(want instanceof Element)) return false;
  let changed = false;
  for (const a of [...node.attributes]) if (!want.hasAttribute(a.name) && !VOLATILE.test(a.name)) { node.removeAttribute(a.name); changed = true; }
  for (const a of want.attributes) if (node.getAttribute(a.name) !== a.value) { node.setAttribute(a.name, a.value); changed = true; }
  const tag = node.tagName, field = /** @type {HTMLInputElement} */ (node);
  if (tag === "INPUT" && (field.type === "checkbox" || field.type === "radio")) {
    if (field.checked !== want.hasAttribute("checked")) { field.checked = want.hasAttribute("checked"); changed = true; }
  } else if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && node !== focus) {
    const v = tag === "TEXTAREA" ? want.textContent : want.getAttribute("value");
    if (v != null && field.value !== v) { field.value = v; changed = true; }
  }
  if (node.tagName === "TEXTAREA") return changed;
  return syncChildren(node, want, focus, hold) || changed;
}
