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

/** How far the focused element's scroller must move to show it, or null: in view (even partly), visually hidden,
 *  not in a scroller, or in one that owns its scroll. {sc, dx, dy}: the least distance (the nearest edge). */
export function bring(el, win = window) {
  if (!el || !el.getClientRects || !el.getClientRects().length) return null;
  const r = el.getBoundingClientRect();
  // visually hidden (.sr-only: 1 px wide and clipped; on a phone the 36 px floor makes it 1 × 36): nothing to show
  if (r.width <= 1 || r.height <= 1 || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(win.getComputedStyle(el).clip || "")) return null;
  const sc = scrollerOf(el, win);
  if (!sc || (sc.closest && sc.closest("[data-own-scroll]"))) return null;
  const v = sc.getBoundingClientRect();
  if (!outside(r, v)) return null;
  const dy = r.top < v.top ? r.top - v.top : r.bottom > v.bottom ? Math.min(r.bottom - v.bottom, r.top - v.top) : 0;
  const dx = r.left < v.left ? r.left - v.left : r.right > v.right ? Math.min(r.right - v.right, r.left - v.left) : 0;
  return { sc, dx, dy };
}
export const lost = (el, win = window) => !!bring(el, win);

export function keepFocusInView(doc = document, win = window) {
  // focus the browser moves itself (Tab, a press) it has already brought into view: only a script's is checked
  let own = -1;
  const mine = () => { own = win.performance.now(); };
  doc.addEventListener("pointerdown", mine, true);
  doc.addEventListener("keydown", (e) => { if (e.key === "Tab") mine(); }, true);
  doc.addEventListener("focusin", (e) => {
    if (win.performance.now() - own < 50) return;
    const el = e.target;
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
