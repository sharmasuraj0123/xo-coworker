// @ts-check

// The keyboard's ring over a region you scroll with the keys, drawn as one layer just after it, since its own outline sits under what it paints.
export const REGIONS = ".vw-body, .cx-pd";

/** The ring's box over a region in its parent's padding box; where it meets a rounded parent corner, it follows that corner's inside. @param {{ left: number, top: number, width: number, height: number, radius: number[] }} r @param {{ width: number, height: number, radius: number[], border: number[] }} p */
export function ringBox(r, p) {
  const e = 0.5;
  const L = r.left <= e, T = r.top <= e, R = r.left + r.width >= p.width - e, B = r.top + r.height >= p.height - e;
  const inner = (/** @type {number} */ i, /** @type {number} */ a, /** @type {number} */ b) => Math.max(0, p.radius[i] - Math.max(p.border[a], p.border[b]));
  const at = (/** @type {boolean} */ meets, /** @type {number} */ i, /** @type {number} */ a, /** @type {number} */ b) => (meets ? Math.max(r.radius[i], inner(i, a, b)) : r.radius[i]);
  return {
    left: r.left, top: r.top, width: r.width, height: r.height,
    radius: [at(L && T, 0, 0, 3), at(R && T, 1, 0, 1), at(R && B, 2, 2, 1), at(L && B, 3, 2, 3)],
  };
}

/** @param {string} v */
const px = (v) => parseFloat(v) || 0;
/** @param {CSSStyleDeclaration} cs */
const radii = (cs) => [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px);

/** Draws the ring over whichever region has the keyboard's focus, following its size, and drops it when focus leaves. */
export function regionRings(doc = document, win = window) {
  /** @type {HTMLElement | null} */
  let ring = null;
  /** @type {HTMLElement | null} */
  let on = null;
  /** @type {ResizeObserver | null} */
  let ro = null;
  const drop = () => {
    if (on) on.classList.remove("has-ring");
    on = null;
    if (ro) { ro.disconnect(); ro = null; }
    if (ring) { ring.remove(); ring = null; }
  };
  const place = () => {
    if (!on || !ring) return;
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
    const el = /** @type {HTMLElement | null} */ (doc.activeElement);
    if (!el || !el.matches || !el.matches(REGIONS) || !el.matches(":focus-visible")) return;
    if (el.classList && el.classList.contains("vw-doc")) return; // a file you type in draws no ring
    if (el.parentElement && el.offsetParent !== el.parentElement) return; // the outline stays
    if (on === el && ring) { place(); return; }
    drop();
    on = el; el.classList.add("has-ring");
    ring = doc.createElement("div"); ring.className = "region-ring"; ring.setAttribute("aria-hidden", "true");
    if (win.ResizeObserver) { ro = new win.ResizeObserver(place); ro.observe(el); if (el.parentElement) ro.observe(el.parentElement); }
    place();
  };
  doc.addEventListener("focusin", (e) => { const t = /** @type {any} */ (e.target); if (t && t.matches && t.matches(REGIONS)) win.requestAnimationFrame(check); });
  doc.addEventListener("keydown", () => { if (!ring) win.requestAnimationFrame(check); }, true);
  doc.addEventListener("focusout", (e) => { if (e.target === on) drop(); });
  win.addEventListener("resize", () => { if (on) place(); });
}
