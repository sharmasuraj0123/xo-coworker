// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { requireHtml } from "../../core/platform/dom.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import { ShellPanelDeps } from "./panel-types.d.ts" */

/** @param {ShellPanelDeps} options */
export function createShellPanel({ view, STAGE, SH, world, heraldShow }) {
  const scope = createScope();
  const dock = requireHtml("#shd");
  const parent = /** @type {ParentNode} */ (dock.parentNode), next = dock.nextSibling;
  let mounted = false;
  /** @type {(() => void) | undefined} */
  let cancelOpen;
  function restore() {
    if (!mounted) return;
    mounted = false;
    dock.classList.remove("in-panel");
    parent.insertBefore(dock, next);
  }
  /** @param {boolean} on @param {HTMLElement} [host] @param {string} [where] */
  async function panelShell(on, host, where) {
    if (scope.signal.aborted) return;
    cancelOpen?.();
    if (!on || !host) {
      restore();
      SH.hide();
      return;
    }
    if (!SH.enabled) {
      STAGE.shellOff();
      heraldShow({ kind: "calm", text: "Shells aren't on here" }, 3200);
      return;
    }
    host.append(dock);
    dock.classList.add("in-panel");
    mounted = true;
    const intent = new AbortController();
    const finish = scope.effect(() => () => {
      cancelOpen = undefined;
      intent.abort();
    });
    cancelOpen = finish;
    const at = where || view();
    const current = () => !intent.signal.aborted && STAGE.isShell;
    try {
      await openShell(at.startsWith("t:") || at.startsWith("p:") ? at : "ws", { signal: intent.signal });
    } catch (error) {
      if (!current()) return;
      finish();
      reportFailure(error);
      STAGE.shellOff();
      return;
    }
    if (!current()) return;
    finish();
    if (dock.hidden) STAGE.shellOff();
  }
  const observer = new MutationObserver(() => {
    if (mounted && !cancelOpen && STAGE.isShell && dock.hidden) STAGE.shellOff();
  });
  scope.effect(() => restore);
  scope.observe(observer);
  observer.observe(dock, { attributes: true, attributeFilter: ["hidden"] });
  /** @param {string} where @param {{signal: AbortSignal}} [options] */
  function openShell(where, options) {
    if (where === "ws") return SH.openWorkspace(options);
    if (where.startsWith("p:")) return SH.openProject(where.slice(2), options);
    const t = world.thread(where.slice(2));
    if (t) return SH.openThread({ project: t.project, chatId: t.chatId, ts: t.id, title: t.title }, options);
  }
  return { panelShell, openShell, dispose: scope.dispose };
}
