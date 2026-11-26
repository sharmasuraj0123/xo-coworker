// @ts-check
import { requireHtml } from "../core/platform/dom.js";
import { redraw } from "../core/ui/redraw.js";
import { xi } from "../core/ui/icons/icon.js";

/** @param {() => string} view @param {() => readonly unknown[]} projects */
export function createWorkspaceHeader(view, projects) {
  return function wsHeadRender() {
    const box = requireHtml("#ws-head");
    if (view() !== "ws") { box.hidden = true; return; }
    box.hidden = false;
    redraw(box, `<div class="wsh"><div class="wsh-mark">${xi("layers")}</div><h2 class="wsh-h">Workspace</h2>` +
      `<p class="wsh-p">Your coordinator, across all ${projects().length} projects. Tell it what should get done; it routes the work. What needs you waits on <button type="button" class="wsh-home" data-go="home">Home</button>.</p></div>`);
  };
}
