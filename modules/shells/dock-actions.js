// @ts-check

import { api } from "../../core/platform/api.js";
import { busyWith, isDetached, listRows, cleanName } from "./model.js";

/** @param {import('./dock-types.js').DockState} R @param {import('./dock-types.js').DockActionOptions} actions */
export function createDockActions(R, { root, listEl, confirmEl, LIST, byId, upsert, nameOf, render, changed, detach, refreshSoon, notify, announce }) {
  /** Close: asks first when a program runs in it, where Close was pressed (its row in the list, else the bar). @param {string} id */
  async function askClose(id, row = false) {
    let t = byId(id);
    try { t = (await api.terminal(id)).terminal; upsert(t); } catch { /* it may be gone: closing still tidies up */ }
    const fg = busyWith(t);
    if (fg) { R.confirm = { kind: "close", id, fg, row }; render(); root.querySelector(row ? ".shl-ask [data-sh-no]" : ".shd-confirm [data-sh-no]")?.focus(); return; }
    closeShell(id);
  }
  /** Keep it (or Esc): the question goes, and focus goes back to the Close that asked it. */
  function keepIt() {
    const c = R.confirm;
    R.confirm = null; render();
    const back = c?.kind === "close" ? root.querySelector(`${c.row ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(c.id)}"]`) : root.querySelector("[data-sh-closedet]");
    back?.focus();
  }
  /** @param {string} id */
  async function closeShell(id) {
    const had = root.contains(document.activeElement);
    const at = [...listEl.querySelectorAll(".shl-row [data-sh-close]")].findIndex((b) => b.dataset.shClose === id); // its place in the list
    R.confirm = null;
    R.busy.add(id); render();
    // the question (Close shell, Keep it) went in that render: its × (Closing…) holds focus while it closes
    if (had && (!root.contains(document.activeElement) || document.activeElement === document.body)) root.querySelector(`${R.active === LIST ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(id)}"]`)?.focus();
    const name = nameOf(id);
    try {
      await api.closeTerminal(id);
      announce(`${name} closed`);
    } catch (err) {
      // refused: the shell still runs, so its tab, its socket and its row stay, and focus goes back to Close
      if ((/** @type {import("./dock-types.js").DockError} */ (err)).code !== "terminal_not_found") {
        R.busy.delete(id);
        notify({ kind: "stopped", text: `Couldn't close ${name}`, sub: (/** @type {import("./dock-types.js").DockError} */ (err)).message });
        announce(`Couldn't close ${name}: ${(/** @type {import("./dock-types.js").DockError} */ (err)).message}. It's still running.`);
        changed();
        if (had) root.querySelector(`${R.active === LIST ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(id)}"]`)?.focus();
        return;
      }
    }
    R.busy.delete(id);
    detach(id, { quiet: true });
    R.list = R.list.filter((t) => t.id !== id);
    changed();
    refreshSoon();
    // Focus the neighboring tab or row after closing.
    if (had && (!root.contains(document.activeElement) || document.activeElement === document.body)) {
      const t = R.tabs.get(R.active);
      if (t) t.handle.focus();
      else { const xs = [...listEl.querySelectorAll(".shl-row [data-sh-close]")]; (xs[Math.min(Math.max(at, 0), xs.length - 1)] || listEl.querySelector("[data-sh-new]"))?.focus(); }
    }
  }
  function askCloseDetached() {
    const ids = listRows(R.list, R.filter).filter(isDetached).map((t) => t.id);
    if (!ids.length) return;
    R.confirm = { kind: "detached", ids };
    render();
    confirmEl.querySelector("[data-sh-no]")?.focus();
  }
  /** @param {string[]} ids */
  async function closeDetached(ids) {
    const had = root.contains(document.activeElement);
    const lost = () => had && (!root.contains(document.activeElement) || document.activeElement === document.body);
    R.confirm = null;
    for (const id of ids) R.busy.add(id);
    render();
    // the question went in that render: Close all detached holds focus while they close
    if (lost()) listEl.querySelector("[data-sh-closedet]")?.focus();
    const failed = [];
    for (const id of ids) {
      let gone = true;
      try { await api.closeTerminal(id); } catch (err) { if ((/** @type {import("./dock-types.js").DockError} */ (err)).code !== "terminal_not_found") { failed.push((/** @type {import("./dock-types.js").DockError} */ (err)).message); gone = false; } }
      R.busy.delete(id);
      if (gone) R.list = R.list.filter((t) => t.id !== id); // a refused one still runs: its row stays
    }
    if (failed.length) notify({ kind: "stopped", text: `Couldn't close ${failed.length} of ${ids.length}`, sub: failed[0] });
    else announce(`${ids.length} detached shell${ids.length === 1 ? "" : "s"} closed`);
    changed();
    refreshSoon();
    // done: Close all detached again if some were refused, else New shell (the list's way on)
    if (lost()) (listEl.querySelector("[data-sh-closedet]") || listEl.querySelector("[data-sh-new]"))?.focus();
  }

  /** Rename where the name lives: in its tab when the shell is on screen, else in its row of the list. @param {string} id */
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
    let failed = false;
    try {
      const d = await api.renameTerminal(id, name);
      upsert(d.terminal);
      const tab = R.tabs.get(id);
      if (tab) tab.name = d.terminal.name;
      announce(`Renamed it ${d.terminal.name}.`);
    } catch (err) {
      failed = true;
      notify({ kind: "stopped", text: "Couldn't rename the shell", sub: (/** @type {import("./dock-types.js").DockError} */ (err)).message });
      announce(`Couldn't rename the shell: ${(/** @type {import("./dock-types.js").DockError} */ (err)).message}. What you typed is still there: Enter tries again, Esc keeps the old name.`);
    } finally {
      R.busy.delete(id);
      // refused: the field comes back holding what was typed, the caret at its end (nothing typed is lost)
      if (failed) R.edit = id;
      changed();
      if (failed) {
        const inp = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-sh-name="${CSS.escape(id)}"]`));
        if (inp) { inp.value = name; if (refocus) { inp.focus(); inp.setSelectionRange(name.length, name.length); } }
      } else if (refocus) root.querySelector(back)?.focus();
    }
  }

  return { askClose, keepIt, closeShell, askCloseDetached, closeDetached, startRename, renameBack, saveRename };
}
