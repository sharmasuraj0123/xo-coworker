// Focus is never somewhere you can't see it. A control a script hands focus to with preventScroll (so a page that's
// already where it should be doesn't jump) can be scrolled out of its own scroller: Settings › Keyboard's Reset all
// put focus on the first shortcut, 972 px above the screen (the create-project/Launchpad grader on c055e74, S023). So
// whatever takes focus, once it has, is checked against the box it scrolls in; wholly outside it, it's brought in,
// the least distance (nearest). A Tab or a click already lands on something in view, so this answers only a script.
export const outside = (r, v) => r.bottom <= v.top || r.top >= v.bottom || r.right <= v.left || r.left >= v.right;

/** The nearest ancestor that scrolls (and has something to scroll), or null for the page itself. */
export function scrollerOf(el, win = window) {
  for (let n = el.parentElement; n && n !== el.ownerDocument.body && n !== el.ownerDocument.documentElement; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    const y = /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1, x = /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1;
    if (y || x) return n;
  }
  return null;
}

/** Is this focused element wholly out of the box it scrolls in? (a 1 px or smaller one, visually hidden, is left) */
export function lost(el, win = window) {
  if (!el || !el.getClientRects || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 1 && r.height <= 1) return false;
  const sc = scrollerOf(el, win);
  const v = sc ? sc.getBoundingClientRect() : { top: 0, left: 0, bottom: win.innerHeight, right: win.innerWidth };
  return outside(r, v);
}

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
    win.requestAnimationFrame(() => { if (doc.activeElement === el && lost(el, win)) el.scrollIntoView({ block: "nearest", inline: "nearest" }); });
  });
}
