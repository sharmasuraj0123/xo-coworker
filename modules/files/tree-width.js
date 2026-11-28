// @ts-check

import { read, write } from "../../core/platform/storage.js";

const TW_KEY = "xo-files-tree", TW_DEF = 240, TW_MIN = 160, TW_MAX = 420;

/** @param {HTMLElement} pane @param {HTMLElement} body */
export function createTreeWidth(pane, body) {
  let width = read(TW_KEY, (raw) => Number(raw) || TW_DEF, TW_DEF);
  const setWidth = (/** @type {number} */ next, save = false) => {
    width = Math.round(Math.max(TW_MIN, Math.min(TW_MAX, next)));
    pane.style.setProperty("--tw", `${width}px`);
    if (save) write(TW_KEY, String(width));
  };
  setWidth(width);

  return (/** @type {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} */ scope) => {
    const line = /** @type {HTMLElement | null} */ (body.querySelector(".fl-split"));
    if (!line) return;
    scope.listen(line, "pointerdown", (event) => {
      const e = /** @type {PointerEvent} */ (event);
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      document.body.classList.add("fv-sizing");
      const left = body.getBoundingClientRect().left;
      const move = (/** @type {Event} */ ev) => setWidth(/** @type {PointerEvent} */ (ev).clientX - left);
      const stopMove = scope.listen(line, "pointermove", move);
      const clearSizing = scope.effect(() => () => document.body.classList.remove("fv-sizing"));
      const up = () => {
        stopMove();
        stopUp();
        stopCancel();
        clearSizing();
        setWidth(width, true);
      };
      const stopUp = scope.listen(line, "pointerup", up);
      const stopCancel = scope.listen(line, "pointercancel", up);
    });
    scope.listen(line, "dblclick", () => setWidth(TW_DEF, true));
    scope.listen(line, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setWidth(width + (e.key === "ArrowRight" ? 16 : -16), true);
    });
  };
}
