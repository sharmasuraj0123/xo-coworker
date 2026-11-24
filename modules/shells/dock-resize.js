// @ts-check

import { createScope } from "../../core/kernel/scope.js";

/** @import { DockInputOptions, DockState } from "./dock-types.d.ts" */

const MIN_H = 140;
const KEY_STEP = 32;
const MAX_HEIGHT = 0.85;

/** @param {number} height */
const clampHeight = (height) => Math.round(Math.max(MIN_H, Math.min(innerHeight * MAX_HEIGHT, height)));

/** @typedef {Pick<DockInputOptions, "grip" | "root" | "scope" | "render" | "persist"> & { refit: () => void }} ResizeOptions */

/** @param {DockState} state @param {ResizeOptions} options */
export function bindDockResize(state, { grip, root, scope, render, persist, refit }) {
  let endResize = () => {};
  scope.listen(grip, "pointerdown", (pointerDown) => {
    if (state.min) return;
    const down = /** @type {PointerEvent} */ (pointerDown);
    endResize();
    down.preventDefault();
    grip.setPointerCapture(down.pointerId);
    const startHeight = state.h;
    const resize = createScope();
    endResize = scope.effect(() => () => {
      resize.dispose();
      root.classList.remove("is-dragging");
      if (grip.hasPointerCapture(down.pointerId)) grip.releasePointerCapture(down.pointerId);
    });
    root.classList.add("is-dragging");
    resize.listen(grip, "pointermove", (event) => {
      const move = /** @type {PointerEvent} */ (event);
      if (move.pointerId !== down.pointerId) return;
      state.h = clampHeight(startHeight + down.clientY - move.clientY);
      root.style.setProperty("--shd-h", `${state.h}px`);
    });
    /** @param {Event} release */
    const finish = (release) => {
      if ((/** @type {PointerEvent} */ (release)).pointerId !== down.pointerId) return;
      endResize();
      persist();
      refit();
    };
    resize.listen(grip, "pointerup", finish);
    resize.listen(grip, "pointercancel", finish);
  });
  scope.listen(grip, "keydown", (event) => {
    const { key } = /** @type {KeyboardEvent} */ (event);
    if (key !== "ArrowUp" && key !== "ArrowDown") return;
    event.preventDefault();
    state.h = clampHeight(state.h + (key === "ArrowUp" ? KEY_STEP : -KEY_STEP));
    render();
    persist();
  });
}
