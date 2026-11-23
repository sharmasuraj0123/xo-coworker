// @ts-check

/** @param {{ el: HTMLElement, S: { full: boolean, open: boolean }, coverSync: () => void, capAgents: () => void }} deps */
export function createWidth({ el, S, coverSync, capAgents }) {
  const W_KEY = "xo-stage-w2", W_SHARE = 0.4, W_MIN = 320, CHAT_MIN = 480;
  const READ = 560;
  // Read the sidebar width on resize to avoid forcing layout during panel updates.
  let sideWv = /** @type {number | null} */ (null);
  const sideW = () => {
    if (sideWv == null) { const side = document.querySelector(".side"); sideWv = side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0; }
    return sideWv;
  };
  addEventListener("resize", () => { sideWv = null; });
  const side = document.querySelector(".side");
  if (typeof ResizeObserver === "function" && side) new ResizeObserver(() => { sideWv = null; apply(); }).observe(side);
  /** @param {number} w */
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(innerWidth - sideW() - CHAT_MIN, w)));
  const wDef = () => (innerWidth - sideW()) * W_SHARE;
  let wSaved = 0;
  try { wSaved = Number(localStorage.getItem(W_KEY)) || 0; } catch { /* private mode */ }
  function apply() {
    const v = clampW(wSaved || wDef());
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", innerWidth > 760 && innerWidth - sideW() - v < READ);
  }
  /** @param {number} w */
  const setW = (w, save = false) => {
    wSaved = w ? clampW(w) : 0;
    if (save) { try { localStorage.setItem(W_KEY, String(wSaved)); } catch { /* private mode */ } }
    apply();
    return wSaved;
  };
  apply();
  addEventListener("resize", () => { apply(); coverSync(); if (S.open) capAgents(); });
  const grip = /** @type {HTMLElement} */ (el.querySelector(".stg-grip"));
  grip.addEventListener("pointerdown", (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0 || S.full) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const right = el.getBoundingClientRect().right;
    document.body.classList.add("stage-sizing");
    const move = (/** @type {PointerEvent} */ ev) => setW(right - ev.clientX);
    const up = () => { grip.removeEventListener("pointermove", move); document.body.classList.remove("stage-sizing"); setW(wSaved || clampW(wDef()), true); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => { try { localStorage.removeItem(W_KEY); } catch { /* private mode */ } setW(0); });
  grip.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW((wSaved || clampW(wDef())) + (e.key === "ArrowLeft" ? 16 : -16), true);
  });
  return { apply };
}
