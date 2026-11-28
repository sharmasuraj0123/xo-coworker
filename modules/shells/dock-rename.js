// @ts-check

import { api } from "../../core/platform/api.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { cleanName } from "./model.js";

/** @import { DockRenameOptions, DockState } from "./dock-types.d.ts" */

/** @param {DockState} R @param {DockRenameOptions} options */
export function createDockRename(R, { requests, root, upsert, nameOf, render, changed, notify, announce }) {
  /** @param {string} id */
  function startRename(id) {
    R.edit = id;
    render();
    const inp = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-sh-name="${CSS.escape(id)}"]`));
    if (inp) { inp.focus(); inp.select(); }
  }
  /** Where focus goes when a name field closes: its tab, or (renamed in the list) the row's Rename. @param {string} id */
  const renameBack = (id) => (R.active === id ? `[data-sh-tab="${CSS.escape(id)}"]` : `.shl-row [data-sh-rename="${CSS.escape(id)}"]`);
  /** @param {string} id @param {string} value */
  async function saveRename(id, value) {
    const back = renameBack(id);
    const refocus = root.contains(document.activeElement) || document.activeElement === document.body;
    R.edit = null;
    const name = cleanName(value);
    if (!name || name === nameOf(id)) { render(); if (refocus) root.querySelector(back)?.focus(); return; }
    R.busy.add(id); render();
    if (refocus) root.querySelector(back)?.focus(); // the field went in that render: its tab has focus while it saves
    await requests.write(() => api.renameTerminal(id, name), (result) => {
      if (result.ok) {
        const { terminal } = result.value;
        upsert(terminal);
        const tab = R.tabs.get(id);
        if (tab) tab.name = terminal.name;
        announce(`Renamed it ${terminal.name}.`);
      } else {
        const message = requestFailureMessage(result.error, "Couldn't rename the shell.");
        notify({ kind: "stopped", text: "Couldn't rename the shell", sub: message });
        announce(`Couldn't rename the shell: ${message}. What you typed is still there: Enter tries again, Esc keeps the old name.`);
      }
      R.busy.delete(id);
      if (!result.ok) R.edit = id;
      changed();
      if (!result.ok) {
        const inp = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-sh-name="${CSS.escape(id)}"]`));
        if (inp) { inp.value = name; if (refocus) { inp.focus(); inp.setSelectionRange(name.length, name.length); } }
      } else if (refocus) root.querySelector(back)?.focus();
    });
  }
  return { startRename, renameBack, saveRename };
}
