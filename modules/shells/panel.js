// @ts-check
import { $ } from "../../core/platform/dom.js";

/** @import { ShellPanelDeps } from "./panel-types.d.ts" */

/** @param {ShellPanelDeps} options */
export function createShellPanel({ S, STAGE, SH, world, heraldShow }) {
  const SHD_HOME = { parent: /** @type {ParentNode} */ ($("#shd").parentNode), next: $("#shd").nextSibling };
  /** @param {boolean} on @param {HTMLElement} host @param {string} [where] */
  function panelShell(on, host, where) {
    const d = $("#shd");
    if (on) {
      if (!SH.enabled) { STAGE.shellOff(); heraldShow({ kind: "calm", text: "Shells aren't on here" }, 3200); return; }
      host.append(d); d.classList.add("in-panel");
      const at = where || S.view;
      // one that couldn't open goes back
      Promise.resolve(openShell(at.startsWith("t:") || at.startsWith("p:") ? at : "ws")).then(() => { if (STAGE.isShell && d.hidden) STAGE.shellOff(); }, () => { if (STAGE.isShell) STAGE.shellOff(); });
    } else {
      d.classList.remove("in-panel");
      SHD_HOME.parent.insertBefore(d, SHD_HOME.next);
      SH.hide();
    }
  }
  new MutationObserver(() => { if (STAGE.isShell && $("#shd").hidden) STAGE.shellOff(); }).observe($("#shd"), { attributes: true, attributeFilter: ["hidden"] });
  /** @param {string} where */
  function openShell(where) {
    if (where === "ws") return SH.openWorkspace();
    if (where.startsWith("p:")) return SH.openProject(where.slice(2));
    const t = world.thread(where.slice(2));
    if (t) SH.openThread({ project: t.project, chatId: t.chatId, ts: t.id, title: t.title });
  }
  return { panelShell, openShell };
}
