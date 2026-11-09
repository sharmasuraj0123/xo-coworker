// Focus is never somewhere you can't see it. A control a script hands focus to with preventScroll (so a page that's
// already where it should be doesn't jump) can be scrolled out of its own scroller: Settings › Keyboard's Reset all
// put focus on the first shortcut, 972 px above the screen (the create-project/Launchpad grader on c055e74, S023).
// 175 script focus calls in 20 files hand focus on like that; one rule covers them (the owner's choice, 9 Nov):
// whatever a script focuses, once the moment's layout has settled, is checked against the box it scrolls in, and if
// what focus draws isn't wholly inside (the control as it's seen, a checkbox's label, with its ring and its room),
// that one box is scrolled the least distance to show it all. A Tab's focus is checked too: the browser brings the
// control into view, but not the ring its label or field box draws for it (the create-project grader on e55c2d8,
// C115 on a phone: the label flush with the screen's foot, 3 px of its ring cut; S111/S112 the same at a scroller's
// foot). Never more:
//   · a press's focus isn't checked: the pointer is on it;
//   · only the nearest scroller moves, never its ancestors (scrollIntoView also scrolls clipped boxes and a phone's
//     sheet), and a scroller that owns its scroll (data-own-scroll: the conversation, whose reading place follow.js
//     keeps) is left to its owner;
//   · a visually hidden control (.sr-only: 1 px wide, clipped) is left.
export const outside = (r, v) => r.bottom <= v.top || r.top >= v.bottom || r.right <= v.left || r.left >= v.right;

/** The nearest ancestor that scrolls (and has something to scroll), or null for none. */
export function scrollerOf(el, win = window) {
  for (let n = el.parentElement; n && n !== el.ownerDocument.body && n !== el.ownerDocument.documentElement; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    const y = /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1, x = /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1;
    if (y || x) return n;
  }
  return null;
}

/** The control as it's seen: a checkbox or radio inside its label is the label (the native box is small, or hidden,
 *  and the label is what's pressed and what must be on screen: the create-project grader on 65e84b7, C115 on a phone,
 *  Codex's label 11 px under the screen's foot with its box in view). */
export const seen = (el) => (el && el.matches && el.matches('input[type="checkbox"], input[type="radio"]') && el.closest && el.closest("label")) || el;

/** The room a control keeps clear round it when it's brought into view: its scroll-margin, which is the ring's room
 *  (base.css, --ring-room), as the browser's own scrollIntoView keeps it (the create-project grader on 65e84b7,
 *  S111/S112: brought flush with the scroller's foot, the ring was cut off). */
export function room(el, win = window) {
  const cs = el && el.nodeType !== 3 ? win.getComputedStyle(el) : null, n = (x) => parseFloat(x) || 0;
  return cs ? { t: n(cs.scrollMarginTop), r: n(cs.scrollMarginRight), b: n(cs.scrollMarginBottom), l: n(cs.scrollMarginLeft) } : { t: 0, r: 0, b: 0, l: 0 };
}

/** The rings drawn for a control, and how far each reaches past its element: the control's own, and any box that draws
 *  one for it (a checkbox's label, a search field's box: `:has(input:focus-visible)`), up to three levels out. All of
 *  them, never the first only (the create-project grader's C115: a checkbox and its label each drew one). */
export function ringsOf(el, win = window) {
  const out = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    const cs = win.getComputedStyle(n), w = parseFloat(cs.outlineWidth) || 0;
    if (cs.outlineStyle && cs.outlineStyle !== "none" && w > 0) out.push({ el: n, ext: Math.max(0, w + (parseFloat(cs.outlineOffset) || 0)) }); // how far it reaches outside: an inset ring, none
  }
  return out;
}
/** All that focus draws for a control, in the viewport's px: the control as it's seen (a checkbox's label), every ring
 *  drawn for it past its element, and the control's room (its scroll-margin). One measure for every control, never
 *  one border box at a time (the create-project grader on e55c2d8, C115). */
export function decoration(el, win = window) {
  const s = seen(el), m = room(el, win), a = el.getBoundingClientRect(), b = s === el ? a : s.getBoundingClientRect();
  const d = { top: Math.min(a.top - m.t, b.top), bottom: Math.max(a.bottom + m.b, b.bottom), left: Math.min(a.left - m.l, b.left), right: Math.max(a.right + m.r, b.right) };
  for (const g of ringsOf(el, win)) {
    const c = g.el === el ? a : g.el === s ? b : g.el.getBoundingClientRect(), e = g.ext;
    d.top = Math.min(d.top, c.top - e); d.bottom = Math.max(d.bottom, c.bottom + e); d.left = Math.min(d.left, c.left - e); d.right = Math.max(d.right, c.right + e);
  }
  return d;
}
/** The least move of box v that shows decoration d whole; on an axis it can't fit (a long field, the code editor),
 *  only a control r wholly out of the box moves, to its nearest edge. */
function shift(v, d, r) {
  const out = outside(r, v);
  const axis = (lo, hi, vlo, vhi, rlo, rhi) => (hi - lo <= vhi - vlo
    ? (lo < vlo ? lo - vlo : hi > vhi ? hi - vhi : 0)
    : out ? (rlo < vlo ? rlo - vlo : rhi > vhi ? Math.min(rhi - vhi, rlo - vlo) : 0) : 0);
  return { dy: axis(d.top, d.bottom, v.top, v.bottom, r.top, r.bottom), dx: axis(d.left, d.right, v.left, v.right, r.left, r.right) };
}

/** How far the focused element's scroller must move to show all that focus draws for it, or null: all of it in view,
 *  visually hidden, not in a scroller, or in one that owns its scroll. {sc, dx, dy}: the least distance. */
export function bring(el, win = window) {
  const s = seen(el);
  if (!s || !s.getClientRects || !s.getClientRects().length) return null;
  const r = s.getBoundingClientRect();
  // visually hidden (.sr-only: 1 px wide and clipped; on a phone the 36 px floor makes it 1 × 36): nothing to show
  if (r.width <= 1 || r.height <= 1 || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(win.getComputedStyle(s).clip || "")) return null;
  const sc = scrollerOf(s, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return null;
  const { dx, dy } = shift(sc.getBoundingClientRect(), decoration(el, win), r);
  return dx || dy ? { sc, dx, dy } : null;
}
export const lost = (el, win = window) => !!bring(el, win);

/** Is the element wholly in sight in the box it scrolls in? (with no box it can be scrolled in, or one that owns its
 *  scroll, or visually hidden: nothing to keep, so yes) */
export function inSight(el, win = window) {
  el = seen(el);
  if (!el || !el.getClientRects || !el.getClientRects().length) return true;
  const sc = scrollerOf(el, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return true;
  const r = el.getBoundingClientRect(), v = sc.getBoundingClientRect();
  return r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= v.left - 1 && r.right <= v.right + 1;
}
/** Bring all that focus draws for it into sight: its scroller only, the least distance (bring). */
export function bringWhole(el, win = window) {
  const b = bring(el, win);
  if (b) { b.sc.scrollTop += b.dy; b.sc.scrollLeft += b.dx; }
}

export function keepFocusInView(doc = document, win = window) {
  // a press's own focus (the control pressed, or the nearest focusable around it) isn't checked: the pointer is on it.
  // Everything else is: a script's (even when a press or a key led to it: Close on the Created notice, pressed, handed
  // focus to the editor out of sight, the controls grader on aa2e4f9, S138 on a phone), and a Tab's, whose control the
  // browser brings into view but not the ring its label draws (C115). Checked once the moment's layout has settled
  let press = null;
  doc.addEventListener("pointerdown", (e) => { press = { at: win.performance.now(), t: e.target }; }, true);
  const pressed = (el) => !!press && win.performance.now() - press.at < 400 && !!press.t && (el === press.t || (el.contains && el.contains(press.t)));
  doc.addEventListener("focusin", (e) => {
    const el = e.target;
    if (pressed(el)) return;
    // once the moment's layout has settled (a redraw that put it there, a sheet opening around it, the browser's own
    // scroll for a Tab)
    win.requestAnimationFrame(() => {
      if (doc.activeElement !== el) return;
      const b = bring(el, win);
      if (!b) return;
      b.sc.scrollTop += b.dy; b.sc.scrollLeft += b.dx;
      el.dispatchEvent(new win.CustomEvent("focusbrought", { bubbles: true, detail: { dx: b.dx, dy: b.dy } }));
    });
  });
}
