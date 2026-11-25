// @ts-check
import { $ } from "../../core/platform/dom.js";
import { ICON } from "../../core/ui/icons/names.js";
import { bindComposerDrop } from "./drop.js";

/** @import { Composer, ComposerScope } from "./composer-types.d.ts" */

/** @param {() => string} view @param {Composer["conv"]} conversation @returns {Composer} */
export function createMainComposer(view, conversation) {
  return {
    main: true,
    get view() { return view(); },
    conv: conversation,
    say: $("#say"), send: $("#send"), form: $("#composer"), target: $("#target"), label: $("#say-label"),
    tray: $("#att-tray"), attach: $("#attach"), input: $("#att-input"), note: $("#att-note"), iq: $("#iq"), at: $("#at-list"),
  };
}

/** @param {ComposerScope} scope @param {Composer} main @param {import("./main-composer-types.d.ts").Bindings} bindings */
export function mountMainComposer(scope, main, { wireTray, wireComposer, composerAt, canAttach, addFiles }) {
  main.attach.innerHTML = ICON.clip;
  scope.listen(main.attach, "click", () => main.input.click());
  scope.listen(main.input, "change", () => { addFiles(main.input.files, main); main.input.value = ""; });
  wireTray(main, scope);
  wireComposer(main, scope);
  scope.effect(() => bindComposerDrop({ veil: $("#drop-veil"), icon: $("#drop-ic"), composerAt, canAttach, addFiles }));
}
