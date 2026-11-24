// @ts-check

/** @import { PanelThreadDeps, PanelThreadPress } from "./open-panel-thread-types.d.ts" */

/** @template C @param {PanelThreadDeps<C>} options */
export function createPanelThreadOpener({ S, world, STAGE, TP, go, showMsg }) {
  /** @param {string} v @param {PanelThreadPress} [e] */
  function openFromPanel(v, e) {
    const besideChat = S.view === "ws" || S.view.startsWith("p:"), msg = e?.target?.closest?.("[data-go]")?.dataset.goMsg;
    if (v && v.startsWith("t:") && besideChat && !(e && (e.metaKey || e.ctrlKey)) && world.thread(v.slice(2))) { STAGE.show("thread", v.slice(2), { focus: true }); if (msg) showMsg(msg, TP.C); return; }
    go(v, { panel: true });
    if (msg) showMsg(msg);
  }
  return openFromPanel;
}
