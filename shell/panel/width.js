// @ts-check

// The panel's width: flush to the window's right edge, 360 px by default, 320–720 by dragging its left edge.

/** @typedef {{ el: any, S: any, PAGES: { get(name: string): any }, coverSync: () => void, capAgents: () => void }} WidthDeps */

/** @param {WidthDeps} P @returns {{ apply: () => void }} */
export function createWidth({ el, S, PAGES, coverSync, capAgents }) {
  const W_KEY = "xo-stage-w", W_DEF = 360, W_MIN = 320, W_MAX = 720;
  // with a diff showing the panel widens to WIDE, never past a width you dragged it to yourself
  const WIDE = 560;
  // when the conversation beside it would drop under READ px, the panel floats over it instead of squeezing it
  const READ = 560;
  // the sidebar's width is read once per resize, never mid-change, where the read forced the page's layout
  let sideWv = /** @type {number | null} */ (null);
  const sideW = () => {
    if (sideWv == null) { const side = document.querySelector(".side"); sideWv = side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0; }
    return sideWv;
  };
  addEventListener("resize", () => { sideWv = null; });
  if (typeof ResizeObserver === "function" && document.querySelector(".side")) new ResizeObserver(() => { sideWv = null; }).observe(/** @type {Element} */ (document.querySelector(".side")));
  /** @param {number} w */
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(W_MAX, innerWidth - 480, w)));
  let wSaved = W_DEF, wMine = false;
  try { wMine = !!Number(localStorage.getItem(W_KEY)); wSaved = Number(localStorage.getItem(W_KEY)) || W_DEF; } catch { /* private mode */ }
  // a page with a width of its own keeps it apart from the sections': 480 up to the window less READ, kept per page kind
  const PAGE_MIN = 480;
  // a page's default width: a number, or a function of its room (the window less the sidebar less READ)
  const pageSpecW = () => { const w = S.page && PAGES.get(S.page.name)?.width; return (typeof w === "function" ? w({ room: innerWidth - sideW() - READ }) : w) || 0; };
  /** On a phone the panel is a full-screen sheet, so a page is the window's width. @param {number} w */
  const clampP = (w) => (innerWidth <= 760 ? innerWidth : Math.round(Math.max(PAGE_MIN, Math.min(innerWidth - READ, w))));
  const pageW = () => { let v = 0; try { v = Number(localStorage.getItem(`${W_KEY}:${S.page.name}`)) || 0; } catch { v = 0; } return clampP(v || pageSpecW()); };
  const widthNow = () => (pageSpecW() ? pageW() : S.wide && !wMine && innerWidth - sideW() - WIDE >= READ ? Math.max(clampW(wSaved), clampW(WIDE)) : clampW(wSaved));
  function apply() {
    const v = widthNow();
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  /** @param {number} w */
  const setW = (w, save = false) => {
    if (pageSpecW()) {
      const v = clampP(w);
      try { if (save) localStorage.setItem(`${W_KEY}:${S.page.name}`, String(v)); else S.dragW = v; } catch { /* private mode */ }
      document.documentElement.style.setProperty("--sw", `${v}px`);
      return v;
    }
    wSaved = clampW(w);
    if (save) { wMine = true; try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  setW(wSaved);
  addEventListener("resize", () => { apply(); coverSync(); if (S.open) capAgents(); });
  const grip = el.querySelector(".stg-grip");
  grip.addEventListener("pointerdown", (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0 || S.full) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (/** @type {PointerEvent} */ ev) => { wMine = true; setW(right - ev.clientX); };
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(pageSpecW() ? S.dragW || pageW() : wSaved, true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => {
    if (pageSpecW()) { try { localStorage.removeItem(`${W_KEY}:${S.page.name}`); } catch { /* private mode */ } apply(); return; }
    wMine = false; try { localStorage.removeItem(W_KEY); } catch { /* private mode */ } setW(W_DEF);
  });
  grip.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW(wSaved + (e.key === "ArrowLeft" ? 16 : -16), true);
  });
  return { apply };
}
