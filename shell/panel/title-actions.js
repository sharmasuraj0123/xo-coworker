// @ts-check
import { createScope } from "../../core/kernel/scope.js";

/** @import { PanelTitleAction } from "./panel-types" */

/** @param {HTMLElement} anchor @param {import("./panel-types").StageDeps["places"]} places @param {ReturnType<typeof createScope>} scope */
export function bindTitleActions(anchor, places, scope) {
  /** @type {Map<PanelTitleAction, { button: HTMLButtonElement, dispose(): void }>} */
  const controls = new Map();
  function reconcile() {
    /** @type {PanelTitleAction[]} */
    const actions = places.entries("panel.title-action");
    for (const [action, control] of controls) {
      if (actions.some((entry) => entry === action)) continue;
      control.dispose();
      controls.delete(action);
    }
    for (const action of actions) {
      if (controls.has(action)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stg-ic";
      button.title = action.label;
      button.setAttribute("aria-label", action.label);
      button.innerHTML = action.icon;
      action.init?.(button);
      const mounted = createScope();
      mounted.listen(button, "click", () => action.onPress());
      mounted.effect(() => () => {
        if (button.contains(document.activeElement)) anchor.closest("aside")?.focus({ preventScroll: true });
        button.remove();
      });
      controls.set(action, { button, dispose: mounted.dispose });
    }
    let next = anchor;
    for (const action of actions.toReversed()) {
      const control = controls.get(action);
      if (!control) continue;
      const { button } = control;
      if (button.nextElementSibling !== next) {
        const focused = document.activeElement === button;
        next.before(button);
        if (focused) button.focus({ preventScroll: true });
      }
      next = button;
    }
  }
  if (places.has("panel.title-action")) {
    scope.effect(() => places.watch("panel.title-action", reconcile));
    reconcile();
  }
  scope.effect(() => () => { for (const control of controls.values()) control.dispose(); controls.clear(); });
  return {
    /** @param {string} view @param {string | undefined} page */
    sync(view, page) { for (const [action, { button }] of controls) action.sync?.(button, view, page); },
    leave() { for (const action of controls.keys()) action.leave?.(); },
  };
}
