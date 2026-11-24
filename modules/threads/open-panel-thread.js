// @ts-check

/** @import { PanelThreadDeps, PanelThreadPress } from "./open-panel-thread-types.d.ts" */
import { entryInput } from "../../core/ui/a11y/focus.js";

/** @template C @param {PanelThreadDeps<C>} options */
export function createPanelThreadOpener({ view, world, STAGE, TP, go, showMsg }) {
  /** @param {string} v @param {PanelThreadPress} [e] */
  function openFromPanel(v, e) {
    const place = view(), target = e?.target;
    const msg = target instanceof Element ? target.closest("[data-go]")?.getAttribute("data-go-msg") : null;
    const besideChat = place === "ws" || place.startsWith("p:");
    if (v && v.startsWith("t:") && besideChat && !(e && (e.metaKey || e.ctrlKey)) && world.thread(v.slice(2))) {
      STAGE.show("thread", v.slice(2), { focus: true, input: entryInput(e) });
      if (msg && TP.C) showMsg(msg, TP.C);
      return;
    }
    go(v, { panel: true });
    if (msg) showMsg(msg);
  }
  return openFromPanel;
}
