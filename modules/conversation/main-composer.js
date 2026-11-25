// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { ICON } from "../../core/ui/icons/names.js";
import { bindComposerDrop } from "./drop.js";

/** @import { Composer, ComposerScope } from "./composer-types.d.ts" */

/** @param {() => string} view @param {Composer["conv"]} conversation @returns {Composer} */
export function createMainComposer(view, conversation) {
  return {
    main: true,
    get view() { return view(); },
    conv: conversation,
    say: requireHtml("#say", "textarea"), send: requireHtml("#send", "button"),
    form: requireHtml("#composer", "form"), target: requireHtml("#target", "button"),
    label: requireHtml("#say-label", "label"),
    tray: requireHtml("#att-tray"), attach: requireHtml("#attach", "button"),
    input: requireHtml("#att-input", "input"), note: requireHtml("#att-note"),
    iq: requireHtml("#iq", "button"), at: requireHtml("#at-list"),
  };
}

/** @param {ComposerScope} scope @param {Composer} main @param {import("./main-composer-types.d.ts").Bindings} bindings */
export function mountMainComposer(scope, main, { wireTray, wireComposer, composerAt, canAttach, addFiles }) {
  main.attach.innerHTML = ICON.clip;
  scope.listen(main.attach, "click", () => main.input.click());
  scope.listen(main.input, "change", () => { addFiles(main.input.files, main); main.input.value = ""; });
  wireTray(main, scope);
  wireComposer(main, scope);
  scope.effect(() => bindComposerDrop({ veil: requireHtml("#drop-veil"), icon: requireHtml("#drop-ic"), composerAt, canAttach, addFiles }));
}
