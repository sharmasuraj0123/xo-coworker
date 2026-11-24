// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { createScope } from "../../core/kernel/scope.js";

/** @import { Composer } from "./composer-types.d.ts" */

/** @param {import("./drop-types.d.ts").ComposerDropOptions} options */
export function bindComposerDrop({ veil, icon, composerAt, canAttach, addFiles }) {
  const scope = createScope();
  let depth = 0;
  icon.innerHTML = ICON.clip;
  const hide = () => { depth = 0; veil.hidden = true; };
  /** @param {Event} event */
  const transfer = (event) => {
    const data = (/** @type {DragEvent} */ (event)).dataTransfer;
    return data?.types.includes("Files") ? data : null;
  };
  /** @param {Event} event */
  const composer = (event) => composerAt(event.target instanceof Node ? event.target : null);
  /** @param {Composer} target */
  const takes = (target) => canAttach(target.view) && target.say.getClientRects().length > 0 &&
    !target.say.closest("[inert]") && !document.querySelector(".sheet:not([hidden]), dialog[open]");
  scope.listen(window, "dragenter", (event) => {
    if (!transfer(event)) return;
    event.preventDefault();
    if (takes(composer(event))) { depth++; veil.hidden = false; }
  });
  scope.listen(window, "dragover", (event) => {
    const data = transfer(event);
    if (!data) return;
    event.preventDefault();
    data.dropEffect = veil.hidden ? "none" : "copy";
  });
  scope.listen(window, "dragleave", (event) => { if (transfer(event) && --depth <= 0) hide(); });
  scope.listen(window, "drop", (event) => {
    const data = transfer(event);
    if (!data) return;
    event.preventDefault();
    const wasVisible = !veil.hidden, target = composer(event);
    hide();
    if (wasVisible && takes(target)) addFiles(data.files, target);
  });
  scope.listen(window, "dragend", hide);
  scope.effect(() => hide);
  return scope.dispose;
}
