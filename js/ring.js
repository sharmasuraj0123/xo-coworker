// The keyboard's ring on a region you scroll with the keys: a file in the viewer (.vw-body), a change's diff in the
// panel (.cx-pd). Its own inset outline sat under what the renderer paints inside it (Astra C087 on dd15034, the diff:
// it showed only at the bottom corners; C096 on cb7afe7, the file: focused and unfocused were pixel-identical), so the
// ring is one layer drawn just after the region, over its box, by one rule for both (css/panel.css .region-ring). It
// lives beside the region, so it scrolls, clips and stacks with it; it follows the region's size, and goes when the
// region loses the keyboard's focus. A region whose parent doesn't place it keeps the plain outline.
export const REGIONS = ".vw-body, .cx-pd";

/** The ring's box over a region, in the parent's padding box. Its corners are the region's own, except where the
 *  region meets a rounded corner of its parent: there they follow that corner's inside (its radius less its border),
 *  so the parent's rounding can't cut the line. r: {left, top, width, height, radius:[tl,tr,br,bl]};
 *  p: {width, height, radius:[tl,tr,br,bl], border:[top,right,bottom,left]} (the parent's padding box size). */
export function ringBox(r, p) {
  const e = 0.5;
  const L = r.left <= e, T = r.top <= e, R = r.left + r.width >= p.width - e, B = r.top + r.height >= p.height - e;
  const inner = (i, a, b) => Math.max(0, p.radius[i] - Math.max(p.border[a], p.border[b]));
  const at = (meets, i, a, b) => (meets ? Math.max(r.radius[i], inner(i, a, b)) : r.radius[i]);
  return {
    left: r.left, top: r.top, width: r.width, height: r.height,
    radius: [at(L && T, 0, 0, 3), at(R && T, 1, 0, 1), at(R && B, 2, 2, 1), at(L && B, 3, 2, 3)],
  };
}

const px = (v) => parseFloat(v) || 0;
const radii = (cs) => [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px);

export function regionRings(doc = document, win = window) {
  let ring = null, on = null, ro = null;
  const drop = () => {
    if (on) on.classList.remove("has-ring");
    on = null;
    if (ro) { ro.disconnect(); ro = null; }
    if (ring) { ring.remove(); ring = null; }
  };
  const place = () => {
    if (!on) return;
    const p = on.parentElement;
    if (!on.isConnected || doc.activeElement !== on || !on.matches(":focus-visible") || !on.getClientRects().length || !p || on.offsetParent !== p) { drop(); return; }
    if (on.nextElementSibling !== ring) on.after(ring);
    const pc = win.getComputedStyle(p), border = [pc.borderTopWidth, pc.borderRightWidth, pc.borderBottomWidth, pc.borderLeftWidth].map(px);
    const b = ringBox(
      { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight, radius: radii(win.getComputedStyle(on)) },
      { width: p.offsetWidth - border[1] - border[3], height: p.offsetHeight - border[0] - border[2], radius: radii(pc), border },
    );
    Object.assign(ring.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px`, borderRadius: b.radius.map((x) => `${x}px`).join(" ") });
  };
  const check = () => {
    const el = doc.activeElement;
    if (!el || !el.matches || !el.matches(REGIONS) || !el.matches(":focus-visible")) return;
    if (el.parentElement && el.offsetParent !== el.parentElement) return; // the outline stays
    if (on === el && ring) { place(); return; }
    drop();
    on = el; el.classList.add("has-ring");
    ring = doc.createElement("div"); ring.className = "region-ring"; ring.setAttribute("aria-hidden", "true");
    if (win.ResizeObserver) { ro = new win.ResizeObserver(place); ro.observe(el); ro.observe(el.parentElement); }
    place();
  };
  // after the browser has settled whether this focus shows (:focus-visible, the keyboard's), and on a key that
  // makes it show
  doc.addEventListener("focusin", (e) => { if (e.target && e.target.matches && e.target.matches(REGIONS)) win.requestAnimationFrame(check); });
  doc.addEventListener("keydown", () => { if (!ring) win.requestAnimationFrame(check); }, true);
  doc.addEventListener("focusout", (e) => { if (e.target === on) drop(); });
  win.addEventListener("resize", () => { if (on) place(); });
}
