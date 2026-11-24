// @ts-check
import { $ } from "../core/platform/dom.js";
import { patch } from "../core/ui/patch.js";
import { XO } from "../core/ui/icons/names.js";

/** @param {{ view: string }} S @param {() => readonly unknown[]} projects */
export function createWorkspaceHeader(S, projects) {
  return function wsHeadRender() {
    const box = $("#ws-head");
    if (S.view !== "ws") { box.hidden = true; return; }
    box.hidden = false;
    patch(box, `<div class="wsh"><div class="wsh-mark">${XO}</div><h2 class="wsh-h">Workspace</h2>` +
      `<p class="wsh-p">Your coordinator, across all ${projects().length} projects. Tell it what should get done; it routes the work. What needs you waits on <button type="button" class="wsh-home" data-go="home">Home</button>.</p></div>`);
  };
}
