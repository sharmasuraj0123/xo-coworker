// @ts-check

// Whatever a script or a Tab focuses is brought wholly into sight by its nearest scroller only (scrollIntoView also moves clipped boxes and a phone's sheet).

/** @typedef {{ top: number, bottom: number, left: number, right: number }} Box */

/** A control a person can be on: drawn, here, not inside anything hidden or inert, and not the page itself. @param {Element | null | undefined} el */
export const usable = (el) => !!el && el !== document.body && el.isConnected && !el.closest("[inert], [hidden]") && el.getClientRects().length > 0;

/** A control's identity as a selector, to find it again after a redraw: its id, else its tag and data- hooks, counts aside. @param {Element | null | undefined} el */
export function hookOf(el) {
  if (!el || !el.getAttribute) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const hooks = [...el.attributes].filter((a) => a.name.startsWith("data-") && !/^data-(n|inv|inv-now)$/.test(a.name));
  return hooks.length ? el.tagName.toLowerCase() + hooks.map((a) => (a.value ? `[${a.name}="${CSS.escape(a.value)}"]` : `[${a.name}]`)).join("") : null;
}
/** @param {Box} r @param {Box} v */
export const outside = (r, v) => r.bottom <= v.top || r.top >= v.bottom || r.right <= v.left || r.left >= v.right;

/** The nearest ancestor that scrolls (and has something to scroll), or null for none. @param {Element} el */
export function scrollerOf(el, win = window) {
  for (let n = el.parentElement; n && n !== el.ownerDocument.body && n !== el.ownerDocument.documentElement; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    const y = /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1, x = /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1;
    if (y || x) return n;
  }
  return null;
}

/** The control as it's seen: a checkbox or radio inside its label is the label. @param {Element} el @returns {Element} */
export const seen = (el) => (el && el.matches && el.matches('input[type="checkbox"], input[type="radio"]') && el.closest && el.closest("label")) || el;

/** The room a control keeps clear round it when brought into view: its scroll-margin, the ring's room. @param {Element} el */
export function room(el, win = window) {
  const cs = el && el.nodeType !== 3 ? win.getComputedStyle(el) : null, n = (/** @type {string} */ x) => parseFloat(x) || 0;
  return cs ? { t: n(cs.scrollMarginTop), r: n(cs.scrollMarginRight), b: n(cs.scrollMarginBottom), l: n(cs.scrollMarginLeft) } : { t: 0, r: 0, b: 0, l: 0 };
}

/** Every ring drawn for a control, its own and its label's or field box's up to three levels out, with how far each reaches. @param {Element} el */
export function ringsOf(el, win = window) {
  /** @type {{ el: Element, ext: number }[]} */
  const out = [];
  for (let n = /** @type {Element | null} */ (el), i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    const cs = win.getComputedStyle(n), w = parseFloat(cs.outlineWidth) || 0;
    if (cs.outlineStyle && cs.outlineStyle !== "none" && w > 0) out.push({ el: n, ext: Math.max(0, w + (parseFloat(cs.outlineOffset) || 0)) }); // an inset ring reaches nowhere
  }
  return out;
}
/** All that focus draws for a control, in the viewport's px: the control as seen, every ring past its element, its room. @param {Element} el @returns {Box} */
export function decoration(el, win = window) {
  const s = seen(el), m = room(el, win), a = el.getBoundingClientRect(), b = s === el ? a : s.getBoundingClientRect();
  const d = { top: Math.min(a.top - m.t, b.top), bottom: Math.max(a.bottom + m.b, b.bottom), left: Math.min(a.left - m.l, b.left), right: Math.max(a.right + m.r, b.right) };
  for (const g of ringsOf(el, win)) {
    const c = g.el === el ? a : g.el === s ? b : g.el.getBoundingClientRect(), e = g.ext;
    d.top = Math.min(d.top, c.top - e); d.bottom = Math.max(d.bottom, c.bottom + e); d.left = Math.min(d.left, c.left - e); d.right = Math.max(d.right, c.right + e);
  }
  return d;
}
/** The least move of box v that shows d whole; on an axis it can't fit, only a control r wholly out of the box moves, to its nearest edge. @param {Box} v @param {Box} d @param {Box} r */
function shift(v, d, r) {
  const out = outside(r, v);
  const axis = (/** @type {number} */ lo, /** @type {number} */ hi, /** @type {number} */ vlo, /** @type {number} */ vhi, /** @type {number} */ rlo, /** @type {number} */ rhi) => (hi - lo <= vhi - vlo
    ? (lo < vlo ? lo - vlo : hi > vhi ? hi - vhi : 0)
    : out ? (rlo < vlo ? rlo - vlo : rhi > vhi ? Math.min(rhi - vhi, rlo - vlo) : 0) : 0);
  return { dy: axis(d.top, d.bottom, v.top, v.bottom, r.top, r.bottom), dx: axis(d.left, d.right, v.left, v.right, r.left, r.right) };
}

/** How far the element's scroller must move to show all focus draws for it, or null (in view, hidden, unscrolled, or its scroller owns its scroll). @param {Element} el */
export function bring(el, win = window) {
  const s = seen(el);
  if (!s || !s.getClientRects || !s.getClientRects().length) return null;
  const r = s.getBoundingClientRect();
  if (r.width <= 1 || r.height <= 1 || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(win.getComputedStyle(s).clip || "")) return null; // visually hidden (.sr-only)
  const sc = scrollerOf(s, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return null;
  const { dx, dy } = shift(sc.getBoundingClientRect(), decoration(el, win), r);
  return dx || dy ? { sc, dx, dy } : null;
}
/** @param {Element} el */
export const lost = (el, win = window) => !!bring(el, win);

/** Is the element wholly in sight in the box it scrolls in? Yes when there is nothing to keep. @param {Element} el */
export function inSight(el, win = window) {
  el = seen(el);
  if (!el || !el.getClientRects || !el.getClientRects().length) return true;
  const sc = scrollerOf(el, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return true;
  const r = el.getBoundingClientRect(), v = sc.getBoundingClientRect();
  return r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= v.left - 1 && r.right <= v.right + 1;
}
/** Bring all focus draws for it into sight: its scroller only, the least distance. @param {Element} el */
export function bringWhole(el, win = window) {
  const b = bring(el, win);
  if (b) { b.sc.scrollTop += b.dy; b.sc.scrollLeft += b.dx; }
}

/** Checks every focus but a press's own once the moment's layout has settled, and brings it into sight. */
export function keepFocusInView(doc = document, win = window) {
  /** @type {{ at: number, t: EventTarget | null } | null} */
  let press = null;
  doc.addEventListener("pointerdown", (e) => { press = { at: win.performance.now(), t: e.target }; }, true);
  const pressed = (/** @type {any} */ el) => !!press && win.performance.now() - press.at < 400 && !!press.t && (el === press.t || (el.contains && el.contains(press.t)));
  doc.addEventListener("focusin", (e) => {
    const el = /** @type {Element} */ (e.target);
    if (pressed(el)) return;
    win.requestAnimationFrame(() => {
      if (doc.activeElement !== el) return;
      const b = bring(el, win);
      if (!b) return;
      b.sc.scrollTop += b.dy; b.sc.scrollLeft += b.dx;
      el.dispatchEvent(new win.CustomEvent("focusbrought", { bubbles: true, detail: { dx: b.dx, dy: b.dy } }));
    });
  });
}
