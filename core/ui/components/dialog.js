// @ts-check

export function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "dlg";
  return dialog;
}

/** Closes it once the shared sheet-out has played; at once where nothing animates. @param {HTMLDialogElement} dialog */
export function closeDialog(dialog) {
  if (!dialog.hasAttribute("open") || dialog.classList.contains("is-closing")) return;
  dialog.classList.add("is-closing");
  const done = () => {
    if (!dialog.classList.contains("is-closing")) return;
    dialog.classList.remove("is-closing");
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  };
  const out = dialog.getAnimations?.() ?? [];
  if (out.length) void Promise.all(out.map((a) => a.finished)).then(done, done); else done();
}
