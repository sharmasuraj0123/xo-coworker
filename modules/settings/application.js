// @ts-check
import { $ } from "../../core/platform/dom.js";
import { createShapeView } from "./index.js";
import { createShapeApply } from "./apply-shape.js";
import { createSettingsModule } from "./module.js";
import { createShortcutsSheet } from "./shortcuts-sheet.js";

/** @import { Appearance, SettingsBindings } from "./application-types" */

/** @typedef {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} Scope */

/** @param {Scope} scope @param {Appearance} appearance @param {SettingsBindings} bindings */
export function mountApplicationSettings(scope, appearance, bindings) {
  const { shape, announce, schedule } = appearance;
  const shortcuts = createShortcutsSheet(scope, bindings.focusIn, bindings.onHidden, schedule);
  const SV = createShapeView({ shape, announce });
  const apply = createShapeApply({ ...appearance, SV, SHAPE: shape });
  scope.effect(() => shape.onChange(apply));
  apply({ boot: true });
  const setEl = $("#settings");
  const settings = createSettingsModule({
    ...bindings, el: setEl, side: $("#set-side"), phoneButton: $("#set-phone"), closeButton: $("#set-x"), shape: SV,
  });
  return { SV, settings, setEl, ...shortcuts };
}
