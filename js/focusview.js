// Focus is never somewhere you can't see it. A control a script hands focus to with preventScroll (so a page that's
// already where it should be doesn't jump) can be scrolled out of its own scroller: Settings › Keyboard's Reset all
// put focus on the first shortcut, 972 px above the screen (the create-project/Launchpad grader on c055e74, S023).
// 175 script focus calls in 20 files hand focus on like that; one rule covers them (the owner's choice, 9 Nov):
// whatever a script focuses, once the moment's layout has settled, is checked against the box it scrolls in, and if
// it's wholly outside, that one box is scrolled the least distance to show it. Never more:
//   · a Tab's or a press's focus isn't checked: the browser has already brought it into view;
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

/** How far the focused element's scroller must move to show it, or null: in view (even partly), visually hidden,
 *  not in a scroller, or in one that owns its scroll. {sc, dx, dy}: the least distance (the nearest edge), with the
 *  control's room (its ring) clear of the edge. */
export function bring(el, win = window) {
  const m = room(el, win);
  el = seen(el);
  if (!el || !el.getClientRects || !el.getClientRects().length) return null;
  const r = el.getBoundingClientRect();
  // visually hidden (.sr-only: 1 px wide and clipped; on a phone the 36 px floor makes it 1 × 36): nothing to show
  if (r.width <= 1 || r.height <= 1 || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(win.getComputedStyle(el).clip || "")) return null;
  const sc = scrollerOf(el, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return null;
  const v = sc.getBoundingClientRect();
  if (!outside(r, v)) return null;
  const top = r.top - m.t, bottom = r.bottom + m.b, left = r.left - m.l, right = r.right + m.r;
  const dy = top < v.top ? top - v.top : bottom > v.bottom ? Math.min(bottom - v.bottom, top - v.top) : 0;
  const dx = left < v.left ? left - v.left : right > v.right ? Math.min(right - v.right, left - v.left) : 0;
  return { sc, dx, dy };
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
/** Bring it wholly into sight: its scroller only, the least distance (an element taller than the box: its top). */
export function bringWhole(el, win = window) {
  const m = room(el, win);
  el = seen(el);
  const sc = scrollerOf(el, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return;
  const b = el.getBoundingClientRect(), v = sc.getBoundingClientRect();
  const r = { top: b.top - m.t, bottom: b.bottom + m.b, left: b.left - m.l, right: b.right + m.r }; // with its ring's room
  const dy = r.top < v.top || r.bottom - r.top > v.height ? r.top - v.top : r.bottom > v.bottom ? r.bottom - v.bottom : 0;
  const dx = r.left < v.left || r.right - r.left > v.width ? r.left - v.left : r.right > v.right ? r.right - v.right : 0;
  sc.scrollTop += dy; sc.scrollLeft += dx;
}

export function keepFocusInView(doc = document, win = window) {
  // focus the browser moves itself it has already brought into view, so it isn't checked: a Tab's own move (one no
  // script took over: Tab's wrap in a sheet is a script's), and a press's own focus (the control pressed, or the
  // nearest focusable around it). A script's focus is checked even when a press or a key led to it: Close on the
  // Created notice, pressed, handed focus to the editor out of sight, and the old "within 50 ms of any press"
  // skipped it (the controls grader on aa2e4f9, S138 on a phone)
  // A Tab no script took over moves focus once: that one focus is the browser's, and only that one (a key after it,
  // Enter on Reset all, and the script's focus it leads to is checked: the create-project grader on 65e84b7, S023 on a
  // phone, focus handed 1097 px above the screen within 50 ms of the Tab that reached Reset all)
  let tab = false, press = null;
  doc.addEventListener("keydown", (e) => { if (e.key !== "Tab") tab = false; }, true);
  win.addEventListener("keydown", (e) => { if (e.key === "Tab") tab = !e.defaultPrevented; }); // last, after any script's
  doc.addEventListener("pointerdown", (e) => { tab = false; press = { at: win.performance.now(), t: e.target }; }, true);
  const browsers = (el) => {
    if (tab) { tab = false; return true; }
    return !!press && win.performance.now() - press.at < 400 && !!press.t && (el === press.t || (el.contains && el.contains(press.t)));
  };
  doc.addEventListener("focusin", (e) => {
    const el = e.target;
    if (browsers(el)) return;
    // once the moment's layout has settled (a redraw that put it there, a sheet opening around it)
    win.requestAnimationFrame(() => {
      if (doc.activeElement !== el) return;
      const b = bring(el, win);
      if (!b) return;
      b.sc.scrollTop += b.dy; b.sc.scrollLeft += b.dx;
      el.dispatchEvent(new win.CustomEvent("focusbrought", { bubbles: true, detail: { dx: b.dx, dy: b.dy } }));
    });
  });
}
