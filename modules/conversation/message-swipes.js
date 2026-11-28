// @ts-check

/** @type {import("./swipes-types.d.ts").WireMessageSwipes} */
export function wireMessageSwipes(msgs, scroller, startReply, scope) {
  const REPLY_AT = 56, REPLY_MAX = 72, TIME_MAX = 64;
  /** @typedef {{kind: 'reply', m: HTMLElement, raw: number} | {kind: 'time', m: null, raw: number}} Gesture */

  /** @type {Gesture | null} */
  let g = null;
  let cancelIdle = () => {};
  /** @param {number} raw @param {number} max */
  const band = (raw, max) => (raw <= max ? raw : max + (raw - max) * 0.15);
  /** @param {number} dx */
  function gMove(dx) {
    if ((/** @type {NonNullable<typeof g>} */ (g)).kind === "reply") {
      (/** @type {NonNullable<typeof g>} */ (g)).raw = Math.max(0, (/** @type {NonNullable<typeof g>} */ (g)).raw + dx);
      const d = band((/** @type {NonNullable<typeof g>} */ (g)).raw, REPLY_MAX);
      (/** @type {Extract<Gesture, {kind: 'reply'}>} */ (g)).m.style.setProperty("--mx-drag", d.toFixed(1));
      (/** @type {Extract<Gesture, {kind: 'reply'}>} */ (g)).m.classList.toggle("mx-armed", d >= REPLY_AT);
    } else {
      (/** @type {NonNullable<typeof g>} */ (g)).raw = Math.max(0, (/** @type {NonNullable<typeof g>} */ (g)).raw + dx);
      msgs.style.setProperty("--mx-pull", band((/** @type {NonNullable<typeof g>} */ (g)).raw, TIME_MAX).toFixed(1));
    }
  }
  function gEnd(commit = true) {
    if (!g) return;
    const { kind, m } = g;
    if (kind === "reply") {
      const armed = (/** @type {HTMLElement} */ (m)).classList.contains("mx-armed");
      (/** @type {HTMLElement} */ (m)).classList.remove("mx-dragging", "mx-armed"); (/** @type {HTMLElement} */ (m)).style.removeProperty("--mx-drag");
      if (armed && commit) startReply(/** @type {HTMLElement} */ (m));
    } else {
      msgs.classList.remove("mx-pulling"); msgs.style.removeProperty("--mx-pull");
    }
    g = null;
  }
  /** @param {'reply' | 'time'} kind @param {HTMLElement | null} m */
  function gStart(kind, m) {
    g = /** @type {Gesture} */ ({ kind, m, raw: 0 });
    if (kind === "reply") (/** @type {HTMLElement} */ (m)).classList.add("mx-dragging"); else msgs.classList.add("mx-pulling");
  }
  scope.effect(() => () => gEnd(false));
  let lastV = 0;
  const SIDEWAYS = ".md-table, .md-code pre";
  /** @param {Element | null} t */
  const ownsSideways = (t) => { const el = t && t.closest && t.closest(SIDEWAYS); return !!el && el.scrollWidth > el.clientWidth + 1; };
  scope.listen(scroller, "wheel", (event) => {
    const e = /** @type {WheelEvent} */ (event);
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if (ay > ax) { lastV = e.timeStamp; if (g) gEnd(); return; }
    if (!g && (ax < 6 || ax < ay * 2 || e.timeStamp - lastV < 400 || ownsSideways(/** @type {Element | null} */ (e.target)))) return;
    e.preventDefault();
    if (!g) {
      const m0 = (/** @type {HTMLElement} */ (e.target)).closest?.(".m"), m = m0 && msgs.contains(m0) ? m0 : null;
      if (e.deltaX < 0 && m) gStart("reply", /** @type {HTMLElement} */ (m)); else if (e.deltaX > 0) gStart("time", null); else return;
    }
    gMove((/** @type {NonNullable<typeof g>} */ (g)).kind === "reply" ? -e.deltaX : e.deltaX);
    cancelIdle(); cancelIdle = scope.timeout(gEnd, 140);
  }, { passive: false });
  /** @type {{x: number, y: number, m: HTMLElement | null, on: boolean, last?: number} | null} */
  let touch = null;
  scope.listen(msgs, "pointerdown", (event) => {
    const e = /** @type {PointerEvent} */ (event);
    if (e.pointerType !== "touch" || ownsSideways(/** @type {Element | null} */ (e.target))) { touch = null; return; }
    touch = { x: e.clientX, y: e.clientY, m: (/** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest(".m"))), on: false };
  });
  scope.listen(msgs, "pointermove", (event) => {
    const e = /** @type {PointerEvent} */ (event);
    if (!touch || e.pointerType !== "touch") return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (!touch.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { touch = null; return; }
      if (Math.abs(dx) < 10) return;
      touch.on = true;
      if (dx > 0 && touch.m) gStart("reply", touch.m); else gStart("time", null);
      touch.last = touch.x;
    }
    gMove((/** @type {NonNullable<typeof g>} */ (g)).kind === "reply" ? e.clientX - (/** @type {number} */ (touch.last)) : (/** @type {number} */ (touch.last)) - e.clientX);
    touch.last = e.clientX;
  });
  scope.listen(msgs, "pointerup", () => { if (touch && touch.on) gEnd(); touch = null; });
  scope.listen(msgs, "pointercancel", () => { if (touch && touch.on) gEnd(false); touch = null; });
}
