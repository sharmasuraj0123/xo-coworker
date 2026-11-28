// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import * as K from "../../core/platform/keys.js";

/** @param {HTMLElement} box @param {(text: string) => void} announce @param {() => void} render */
export function createKeysBinding(box, announce, render) {
  const scope = createScope();

  let recording = /** @type {string | null} */ (null);

  let error = /** @type {{id: string, msg: string} | null} */ (null);
  scope.effect(() => () => { recording = null; error = null; });

  /** @param {string} selector */
  const control = (selector) => {
    const element = box.querySelector(selector);
    return element instanceof HTMLElement ? element : null;
  };
  function cancel() {
    if (!recording) return;
    recording = null;
    error = null;
    render();
  }
  scope.listen(box, "click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const rb = /** @type {HTMLElement | null} */ (t.closest("[data-rebind]"));
    if (rb?.dataset.rebind) {
      error = null;
      recording = recording === rb.dataset.rebind ? null : rb.dataset.rebind;
      render();
      return;
    }
    const rs = /** @type {HTMLElement | null} */ (t.closest("[data-kreset]"));
    if (rs?.dataset.kreset) {
      const id = rs.dataset.kreset;
      error = null;
      K.reset(id);
      control(`[data-rebind="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (t.closest("#keys-reset-all")) {
      error = null;
      recording = null;
      K.resetAll();
      control("[data-rebind]")?.focus({ preventScroll: true });
    }
  });
  scope.listen(document, "pointerdown", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest("[data-rebind]")) cancel();
  }, true);
  scope.listen(window, "keydown", (event) => {
    if (!recording) return;
    const e = /** @type {KeyboardEvent} */ (event);
    e.preventDefault(); e.stopPropagation();
    if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) { cancel(); return; }
    const combo = K.fromEvent(e);
    if (!combo) return;
    const id = recording;
    const result = K.set(id, combo);
    recording = null;
    error = "error" in result ? { id, msg: result.error } : null;
    render();
    const action = K.ACTIONS.find((candidate) => candidate.id === id);
    if ("ok" in result && action) announce(`${action.label}: ${K.label(id)}`);
  }, true);
  return {
    read: () => ({ recording, error }),
    capturing: () => recording !== null,
    cancel,
    dispose: scope.dispose,
  };
}
