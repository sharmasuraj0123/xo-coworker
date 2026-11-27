// @ts-check

/** @param {HTMLElement} el @param {(opts: {focus: boolean}) => void} closePick */
export function wirePickKeys(el, closePick) {
  /** @param {KeyboardEvent} e */
  const keydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePick({ focus: true }); return; }
    const grid = document.activeElement?.closest(".pk-grid");
    if (!(grid instanceof HTMLElement) || !el.contains(grid)) return;
    const os = [.../** @type {NodeListOf<HTMLButtonElement>} */ (grid.querySelectorAll(".pk-o"))], i = os.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (i < 0) return;
    const cols = Math.max(1, Math.round(grid.clientWidth / os[0].offsetWidth));
    /** @type {Record<string, number | undefined>} */
    const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: os.length - 1 - i };
    const d = steps[e.key];
    if (d == null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(os.length - 1, i + d));
    os[i].tabIndex = -1; os[j].tabIndex = 0; os[j].focus({ preventScroll: true });
  };
  el.addEventListener("keydown", keydown);
  return () => el.removeEventListener("keydown", keydown);
}
