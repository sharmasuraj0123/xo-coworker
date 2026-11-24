// @ts-check

import { api } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { createDockRename } from "./dock-rename.js";
import { busyWith, isDetached, listRows } from "./model.js";

/** @param {unknown} error */
const alreadyClosed = (error) => error instanceof ApiError && error.code === "terminal_not_found";

/** @param {import('./dock-types.js').DockState} R @param {import('./dock-types.js').DockActionOptions} actions */
export function createDockActions(R, { requests, root, listEl, confirmEl, LIST, byId, upsert, nameOf, render, changed, detach, refreshSoon, notify, announce }) {
  /** Close: asks first when a program runs in it, where Close was pressed (its row in the list, else the bar). @param {string} id */
  function askClose(id, row = false) {
    return requests.read((signal) => api.terminal(id, { signal }), (result) => {
      const terminal = result.ok ? result.value.terminal : byId(id);
      if (result.ok) upsert(terminal);
      else if (!(result.error instanceof ApiError && result.error.status === 404)) requestFailureMessage(result.error, "Couldn't check the shell.");
      const fg = busyWith(terminal);
      if (!fg) { void closeShell(id); return; }
      R.confirm = { kind: "close", id, fg, row };
      render();
      root.querySelector(row ? ".shl-ask [data-sh-no]" : ".shd-confirm [data-sh-no]")?.focus();
    });
  }
  /** Keep it (or Esc): the question goes, and focus goes back to the Close that asked it. */
  function keepIt() {
    const c = R.confirm;
    R.confirm = null; render();
    const back = c?.kind === "close" ? root.querySelector(`${c.row ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(c.id)}"]`) : root.querySelector("[data-sh-closedet]");
    back?.focus();
  }
  /** @param {string} id */
  function closeShell(id) {
    const had = root.contains(document.activeElement);
    const at = [...listEl.querySelectorAll(".shl-row [data-sh-close]")].findIndex((b) => b.dataset.shClose === id); // its place in the list
    R.confirm = null;
    R.busy.add(id); render();
    // the question (Close shell, Keep it) went in that render: its × (Closing…) holds focus while it closes
    if (had && (!root.contains(document.activeElement) || document.activeElement === document.body)) root.querySelector(`${R.active === LIST ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(id)}"]`)?.focus();
    const name = nameOf(id);
    return requests.write(() => api.closeTerminal(id), (result) => {
      R.busy.delete(id);
      if (!result.ok && !alreadyClosed(result.error)) {
        const message = requestFailureMessage(result.error, "Couldn't close the shell.");
        notify({ kind: "stopped", text: `Couldn't close ${name}`, sub: message });
        announce(`Couldn't close ${name}: ${message}. It's still running.`);
        changed();
        if (had) root.querySelector(`${R.active === LIST ? ".shl-row" : ".shd-acts"} [data-sh-close="${CSS.escape(id)}"]`)?.focus();
        return;
      }
      if (result.ok) announce(`${name} closed`);
      detach(id, { quiet: true });
      R.list = R.list.filter((t) => t.id !== id);
      changed();
      refreshSoon();
      if (had && (!root.contains(document.activeElement) || document.activeElement === document.body)) {
        const t = R.tabs.get(R.active);
        if (t) t.handle.focus();
        else { const xs = [...listEl.querySelectorAll(".shl-row [data-sh-close]")]; (xs[Math.min(Math.max(at, 0), xs.length - 1)] || listEl.querySelector("[data-sh-new]"))?.focus(); }
      }
    });
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
    /** @type {string[]} */
    const failed = [];
    for (const id of ids) {
      const completed = await requests.write(() => api.closeTerminal(id), (result) => {
        R.busy.delete(id);
        if (result.ok || alreadyClosed(result.error)) R.list = R.list.filter((t) => t.id !== id);
        else failed.push(requestFailureMessage(result.error, "Couldn't close the shell."));
        return true;
      });
      if (!completed) return;
    }
    requests.publish(() => {
      if (failed.length) notify({ kind: "stopped", text: `Couldn't close ${failed.length} of ${ids.length}`, sub: failed[0] });
      else announce(`${ids.length} detached shell${ids.length === 1 ? "" : "s"} closed`);
      changed();
      refreshSoon();
      if (lost()) (listEl.querySelector("[data-sh-closedet]") || listEl.querySelector("[data-sh-new]"))?.focus();
    });
  }

  const rename = createDockRename(R, { requests, root, upsert, nameOf, render, changed, notify, announce });
  return { askClose, keepIt, closeShell, askCloseDetached, closeDetached, ...rename };
}
