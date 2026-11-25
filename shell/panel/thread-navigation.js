// @ts-check

/** @import { PanelThreadDeps, PanelThreadPress } from "./thread-navigation-types.d.ts" */
import { entryInput } from "../../core/ui/a11y/focus.js";

/** @template C @param {PanelThreadDeps<C>} options */
export function createPanelThreadOpener({ view, world, panelConversation, go, showMsg }) {
  /** @param {string} v @param {PanelThreadPress | undefined} e @param {import("./thread-navigation-types").ShowPage} show */
  function openFromPanel(v, e, show) {
    const place = view(), target = e?.target;
    const msg = target instanceof Element ? target.closest("[data-go]")?.getAttribute("data-go-msg") : null;
    const besideChat = place === "ws" || place.startsWith("p:");
    if (v && v.startsWith("t:") && besideChat && !(e && (e.metaKey || e.ctrlKey)) && world.thread(v.slice(2))) {
      show("thread", v.slice(2), { focus: true, input: entryInput(e) });
      const conversation = panelConversation();
      if (msg && conversation) showMsg(msg, conversation);
      return;
    }
    go(v, { panel: true });
    if (msg) showMsg(msg);
  }
  return openFromPanel;
}
