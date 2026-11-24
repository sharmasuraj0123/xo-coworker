// @ts-check

import { PHONE } from "../../core/platform/viewport.js";
import { erase, read, write } from "../../core/platform/storage.js";
import { createScope } from "../../core/kernel/scope.js";

/** @typedef {ReturnType<typeof createScope>} Scope */
/** @typedef {{full: boolean, open: boolean}} LayoutState */
/** @typedef {{el: HTMLElement, S: LayoutState, coverSync: () => void, capAgents: () => void, scope: Scope}} WidthOptions */

/** @param {WidthOptions} deps */
export function createWidth({ el, S, coverSync, capAgents, scope }) {
  const W_KEY = "xo-stage-w2", W_SHARE = 0.4, W_MIN = 320, CHAT_MIN = 480;
  const READ = 560;
  // Read the sidebar width on resize to avoid forcing layout during panel updates.
  let sideWv = /** @type {number | null} */ (null);
  const sideW = () => {
    if (sideWv != null) return sideWv;
    const side = document.querySelector(".side");
    sideWv = side && getComputedStyle(side).position !== "fixed" ? side.getBoundingClientRect().width : 0;
    return sideWv;
  };
  const side = document.querySelector(".side");
  if (typeof ResizeObserver === "function" && side) {
    const observer = new ResizeObserver(() => { sideWv = null; apply(); });
    observer.observe(side);
    scope.observe(observer);
  }
  /** @param {number} w */
  const clampW = (w) => Math.round(Math.max(W_MIN, Math.min(innerWidth - sideW() - CHAT_MIN, w)));
  const wDef = () => (innerWidth - sideW()) * W_SHARE;
  let wSaved = read(W_KEY, (value) => Number(value) || 0, 0);
  function apply() {
    if (scope.signal.aborted) return;
    const v = clampW(wSaved || wDef());
    document.documentElement.style.setProperty("--sw", `${v}px`);
    document.body.classList.toggle("stage-over", !PHONE?.matches && innerWidth - sideW() - v < READ);
  }
  /** @param {number} w */
  const setW = (w, save = false) => {
    wSaved = w ? clampW(w) : 0;
    if (save) write(W_KEY, String(wSaved));
    apply();
    return wSaved;
  };
  apply();
  const resize = () => {
    sideWv = null;
    apply();
    coverSync();
    if (S.open) capAgents();
  };
  scope.listen(window, "resize", resize);
  if (PHONE) scope.listen(PHONE, "change", resize);
  const grip = /** @type {HTMLElement} */ (el.querySelector(".stg-grip"));
  let stopDrag = () => {};
  scope.listen(grip, "pointerdown", (press) => {
    const e = /** @type {PointerEvent} */ (press);
    if (e.button !== 0 || S.full) return;
    e.preventDefault();
    stopDrag();
    const { pointerId } = e;
    const right = el.getBoundingClientRect().right;
    grip.setPointerCapture(pointerId);
    const drag = createScope();
    stopDrag = scope.effect(() => drag.dispose);
    document.body.classList.add("stage-sizing");
    drag.effect(() => () => {
      document.body.classList.remove("stage-sizing");
      if (grip.hasPointerCapture(pointerId)) grip.releasePointerCapture(pointerId);
    });
    drag.listen(grip, "pointermove", (event) => {
      const move = /** @type {PointerEvent} */ (event);
      if (move.pointerId === pointerId) setW(right - move.clientX);
    });
    /** @param {Event} event */
    const finish = (event) => {
      if ((/** @type {PointerEvent} */ (event)).pointerId !== pointerId) return;
      stopDrag();
      setW(wSaved || clampW(wDef()), true);
    };
    drag.listen(grip, "pointerup", finish);
    drag.listen(grip, "pointercancel", finish);
    drag.listen(grip, "lostpointercapture", finish);
  });
  scope.listen(grip, "dblclick", () => { erase(W_KEY); setW(0); });
  scope.listen(grip, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setW((wSaved || clampW(wDef())) + (e.key === "ArrowLeft" ? 16 : -16), true);
  });
  return { apply };
}

/** @param {HTMLElement} panel @param {LayoutState} state @param {Scope} scope */
export function createCover(panel, state, scope) {
  /** @type {Set<HTMLElement>} */
  const marked = new Set();
  /** @param {HTMLElement} node */
  function release(node) {
    node.inert = false;
    delete node.dataset.stageInert;
    marked.delete(node);
  }
  scope.effect(() => () => {
    for (const node of marked) release(node);
    document.body.classList.remove("stage-covers");
  });

  return function syncCover() {
    if (scope.signal.aborted) return;
    const covers = state.open && !panel.hidden && (state.full || PHONE?.matches === true);
    const herald = document.getElementById("herald");
    /** @type {Set<HTMLElement>} */
    const wanted = new Set();
    /** @param {Element} root */
    function walk(root) {
      for (const child of root.children) {
        if (child === panel || child === herald || child.classList.contains("toast-wrap")) continue;
        if (herald && child.contains(herald)) walk(child);
        else if (child instanceof HTMLElement) wanted.add(child);
      }
    }
    if (covers && panel.parentElement) walk(panel.parentElement);
    for (const node of marked) if (!wanted.has(node)) release(node);
    for (const node of wanted) {
      if (node.inert) continue;
      node.inert = true;
      node.dataset.stageInert = "";
      marked.add(node);
    }
    document.body.classList.toggle("stage-covers", covers);
    const active = document.activeElement;
    const outside = active && !panel.contains(active) && !herald?.contains(active) && !active.closest(".toast-wrap");
    if (covers && (active === document.body || (outside && (active.closest("[inert]") || !active.isConnected)))) {
      panel.focus({ preventScroll: true });
    }
  };
}
