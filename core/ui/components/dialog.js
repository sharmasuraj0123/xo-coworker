// @ts-check

import { leaveWith } from "../motion.js";

export function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "dlg";
  return dialog;
}

/** Closes it once the shared sheet-out has played; at once where nothing animates. @param {HTMLDialogElement} dialog */
export function closeDialog(dialog) {
  if (!dialog.hasAttribute("open")) return;
  leaveWith(dialog, "is-closing", () => { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); });
}
