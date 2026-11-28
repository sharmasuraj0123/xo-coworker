// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createStore } from "../../core/kernel/store.js";

/** @import { Composer } from "./composer-types.d.ts" */

/** @typedef {{ composer: Composer, host: HTMLElement }} PanelComposer */

/** @typedef {{ main: Composer, panel: () => PanelComposer | null, isThread: () => boolean, coversChat: () => boolean }} FocusOptions */

/** @param {FocusOptions} options @param {() => void} onChange */
export function createComposerFocus({ main, panel, isThread, coversChat }, onChange) {
  const scope = createScope();
  const focus = createStore({ composer: main });

  /** @param {Node | null} node */
  function composerAt(node) {
    const side = panel();
    return side && node && side.host.contains(node) ? side.composer : main;
  }

  function composerNow() {
    const side = panel();
    if (!side || !isThread()) return main;
    if (coversChat()) return side.composer;
    const active = document.activeElement;
    if (!active || active === document.body) return focus.get().composer;
    return side.host.contains(active) ? side.composer : main;
  }

  /** @param {string} selector */
  function inUse(selector) {
    return () => {
      const current = composerNow();
      if (selector === "#send") return current.send;
      const node = (current.main ? document : panel()?.host)?.querySelector(selector);
      return node instanceof HTMLElement ? node : null;
    };
  }

  const composers = () => {
    const side = panel();
    return side ? [main, side.composer] : [main];
  };

  scope.effect(() => focus.subscribe(onChange));
  scope.listen(document, "focusin", () => {
    const composer = composerNow();
    if (composer !== focus.get().composer) focus.set({ composer });
  });
  return { composerAt, composerNow, composers, inUse, dispose: scope.dispose };
}
