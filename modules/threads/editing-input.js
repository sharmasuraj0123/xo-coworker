// @ts-check

/** @import { EditInput } from "./editing-input-types.d.ts" */

/** @param {EventTarget | null} target */
function editInput(target) {
  return target instanceof HTMLElement && target.matches("input[data-tedit]") ? /** @type {HTMLInputElement} */ (target) : null;
}

/** @param {HTMLElement} root @param {EditInput} options */
export function bindThreadEditing(root, { scope, controls, endThreadEdit, saveThreadField, closeThreadMenu }) {
  scope.listen(root, "keydown", (event) => {
    const key = /** @type {KeyboardEvent} */ (event);
    const input = editInput(key.target);
    if (input) {
      if (key.isComposing || key.keyCode === 229) { key.stopPropagation(); return; }
      if (key.key !== "Enter" && key.key !== "Escape") return;
      key.preventDefault();
      key.stopPropagation();
      const edit = controls.edit();
      if (!edit) return;
      if (key.key === "Enter") void saveThreadField(edit.tid, edit.field, input.value);
      else if (!edit.busy) endThreadEdit(edit);
      return;
    }
    if (key.key === "Escape" && controls.menu()) {
      key.preventDefault();
      key.stopPropagation();
      closeThreadMenu();
    }
  });

  scope.listen(root, "input", (event) => {
    const input = editInput(event.target), edit = controls.edit();
    if (input && edit) controls.updateEdit(edit, { value: input.value });
  });

  scope.listen(root, "focusout", (event) => {
    const input = editInput(event.target), original = controls.edit();
    if (!input || !original) return;
    scope.timeout(() => {
      const edit = controls.edit();
      const retired = !edit || edit.token !== original.token || edit.busy || !input.isConnected;
      if (retired || document.activeElement === input || input.value === edit.failed) return;
      void saveThreadField(edit.tid, edit.field, input.value);
    }, 0);
  });
}
