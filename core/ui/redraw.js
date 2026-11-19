// @ts-check

// Brings a region's DOM to new HTML in place, keyed by id, data-key or data- hooks, so focus, caret and a press survive.

import { inSight, bringWhole, usable } from "./a11y/focus.js";

/** @typedef {any} Node_ */

/** Redraws el's children to html in place; true if anything changed. @param {Element} el @param {string} html */
export function redraw(el, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const focus = deepActive();
  // a control wholly in sight stays so when what's drawn above it grows
  const seen = !!focus && el.contains(focus) && inSight(focus);
  const changed = syncChildren(el, tpl.content, focus, [focus, pressedNode()].filter(Boolean));
  if (changed && seen && focus.isConnected && !inSight(focus)) bringWhole(focus);
  return changed;
}

/** The node under a pressed pointer until its click: Chromium drops the click when it leaves the page, so a redraw keeps it. @type {any} */
let pressed = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let pressEnd;
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("pointerdown", (e) => { clearTimeout(pressEnd); pressed = e.target; }, true);
  document.addEventListener("pointerup", () => { clearTimeout(pressEnd); pressEnd = setTimeout(() => { pressed = null; }, 600); }, true); // a touch's click can come a moment after the finger lifts
  document.addEventListener("pointercancel", () => { pressed = null; }, true);
  document.addEventListener("click", () => { clearTimeout(pressEnd); pressed = null; }, true);
}
/** The node a pointer is pressing now (null when none, or it already left the page). @returns {Element | null} */
export const pressedNode = () => (pressed && pressed.isConnected ? pressed : null);

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
/** @param {Node_} n */
function keyOf(n) {
  if (n.nodeType !== 1) return null;
  if (n.id) return "#" + n.id;
  const k = n.getAttribute("data-key");
  if (k != null) return "k:" + k;
  let hooks = "";
  for (const a of n.attributes) if (a.name.startsWith("data-") && !VOLATILE.test(a.name)) hooks += `[${a.name}=${a.value}]`;
  return hooks || null;
}
/** @param {Node_} a @param {Node_} b */
const same = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && keyOf(a) === keyOf(b)));

/** A node the page's own script added (data-own) is never matched, moved or removed. @param {Node_} n */
const own = (n) => n.nodeType === 1 && n.hasAttribute("data-own");
/** @param {Node_} from @param {Node_} to @param {Element | null} focus @param {Node_[]} [hold] @returns {boolean} */
function syncChildren(from, to, focus, hold = []) {
  let changed = false;
  let cur = from.firstChild;
  while (cur && own(cur)) cur = cur.nextSibling; // own nodes at the start stay first
  for (const want of [...to.childNodes]) {
    let match = null;
    for (let c = cur; c; c = c.nextSibling) if (!own(c) && same(c, want)) { match = c; break; }
    if (match) {
      // one holding focus or a press isn't moved: what's in between moves instead
      if (match !== cur) {
        if (hold.some((h) => match.contains(h))) { while (cur && cur !== match) { const next = cur.nextSibling; if (!own(cur)) from.appendChild(cur); cur = next; } changed = true; }
        else { from.insertBefore(match, cur); changed = true; }
      }
      if (syncNode(match, want, focus, hold)) changed = true;
      cur = match.nextSibling;
    } else {
      from.insertBefore(want, cur); // adopted from the template: it's new
      changed = true;
    }
  }
  while (cur) { const next = cur.nextSibling; if (!own(cur)) { from.removeChild(cur); changed = true; } cur = next; }
  return changed;
}

/** @param {Node_} node @param {Node_} want @param {Element | null} focus @param {Node_[]} hold @returns {boolean} */
function syncNode(node, want, focus, hold) {
  if (node.nodeType === 3 || node.nodeType === 8) {
    if (node.nodeValue !== want.nodeValue) { node.nodeValue = want.nodeValue; return true; }
    return false;
  }
  if (node.nodeType !== 1) return false;
  let changed = false;
  for (const a of [...node.attributes]) if (!want.hasAttribute(a.name) && !VOLATILE.test(a.name)) { node.removeAttribute(a.name); changed = true; }
  for (const a of want.attributes) if (node.getAttribute(a.name) !== a.value) { node.setAttribute(a.name, a.value); changed = true; }
  const tag = node.tagName;
  // a box or a radio has no draft: it always shows what the new HTML says
  if (tag === "INPUT" && (node.type === "checkbox" || node.type === "radio")) {
    if (node.checked !== want.hasAttribute("checked")) { node.checked = want.hasAttribute("checked"); changed = true; }
  } else if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && node !== focus) {
    const v = tag === "TEXTAREA" ? want.textContent : want.getAttribute("value"); // a field keeps what's typed while the person is in it
    if (v != null && node.value !== v) { node.value = v; changed = true; }
  }
  if (tag === "TEXTAREA") return changed;
  if (tag.includes("-")) return changed; // a custom element draws its own insides
  return syncChildren(node, want, focus, hold) || changed;
}

/** Where focus can land in a row: its controls, in order. */
const LANDING = 'button:not(:disabled), a[href], input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [tabindex="0"]';
/** Keyed rows → box's children: a changed row is drawn anew unless it holds focus or a press (then in place, and it hears "redrawn"); returns the new rows. @param {HTMLElement} box @param {{ key: string, html: string }[]} items @param {{ quiet?: boolean, fallback?: (() => any) | null }} [opts] */
export function reconcile(box, items, { quiet = false, fallback = null } = {}) {
  /** @type {Map<string, any>} */
  const old = new Map();
  for (const el of /** @type {HTMLCollectionOf<HTMLElement>} */ (box.children)) if (el.dataset.k) old.set(el.dataset.k, el);
  /** @type {any[]} */
  const added = [];
  const tpl = document.createElement("template");
  /** @type {any[]} */
  const inPlace = [];
  const active = document.activeElement;
  const pressed = pressedNode();
  // a row that's going while it holds focus hands it to the nearest row that stays, before it, else after it, else the fallback
  const keep = new Set(items.map((it) => it.key));
  const rows = /** @type {HTMLElement[]} */ ([...box.children]);
  const going = rows.find((el) => el.dataset.k && !keep.has(el.dataset.k) && el.contains(active));
  /** @type {any} */
  let near = null;
  if (going) {
    for (let s = /** @type {HTMLElement | null} */ (going.previousElementSibling); s && !near; s = /** @type {HTMLElement | null} */ (s.previousElementSibling)) if (s.dataset.k && keep.has(s.dataset.k)) near = s.dataset.k;
    for (let s = /** @type {HTMLElement | null} */ (going.nextElementSibling); s && !near; s = /** @type {HTMLElement | null} */ (s.nextElementSibling)) if (s.dataset.k && keep.has(s.dataset.k)) near = s.dataset.k;
  }
  items.forEach((it, i) => {
    let el = old.get(it.key);
    if (el && el._h !== it.html) {
      tpl.innerHTML = it.html.trim();
      const fresh = /** @type {any} */ (tpl.content.firstElementChild);
      if (((active && active !== el && el.contains(active)) || (pressed && el.contains(pressed))) && fresh && fresh.tagName === el.tagName) {
        for (const a of [...el.attributes]) if (a.name !== "data-k" && !fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
        for (const a of fresh.attributes) if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value);
        redraw(el, fresh.innerHTML);
        el._h = it.html;
        inPlace.push(el);
      } else {
        fresh.dataset.k = it.key; fresh._h = it.html;
        const had = el === active;
        el.replaceWith(fresh); el = fresh;
        if (had && fresh.tabIndex >= 0) fresh.focus({ preventScroll: true });
      }
    } else if (!el) {
      tpl.innerHTML = it.html.trim();
      el = tpl.content.firstElementChild;
      el.dataset.k = it.key; el._h = it.html;
      if (!quiet) { el.classList.add("is-new"); added.push(el); }
    }
    old.delete(it.key);
    const at = box.children[i];
    if (at !== el) box.insertBefore(el, at || null);
  });
  if (going) {
    near = near && /** @type {HTMLElement[]} */ ([...box.children]).find((el) => el.dataset.k === near);
    const to = (near && [...near.querySelectorAll(LANDING)].find(usable)) || (fallback && fallback());
    if (to && to.focus) to.focus({ preventScroll: true });
  }
  for (const el of old.values()) el.remove();
  for (const el of inPlace) if (el.isConnected) el.dispatchEvent(new CustomEvent("redrawn", { bubbles: true })); // once the list is in its final order
  return added;
}
