// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { menuKeys } from "../../core/ui/a11y/keynav.js";
import { heldBadge } from "../../core/services/world/held.js";

/** @import { DockNeed, Thread, ThreadPageDeps } from "./thread-page-types.d.ts" */

/** @typedef {ThreadPageDeps<unknown, DockNeed>} Page */

/** @typedef {Pick<Page, "STAGE" | "threadControls" | "closeThreadMenu">} Controls */

/** @param {Controls & Pick<Page, "stOf" | "glyphOf" | "isHeld" | "wordOf" | "rtTag" | "threadMenuHtml">} options */
export function createThreadPageHead({ STAGE, threadControls, closeThreadMenu, stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml }) {
  const actions = document.createElement("span");
  let markup = "";

  function mount() {
    markup = "";
    Object.assign(actions, { className: "tp-acts", id: "tpacts" });
    actions.dataset.for = "thread";
    STAGE.slot.append(actions);
    menuKeys(actions, { close: closeThreadMenu });
    return () => actions.remove();
  }

  /** @param {HTMLElement} head @param {Thread} thread */
  function draw(head, thread) {
    const id = esc(thread.id);
    const open = threadControls.menuOpen(thread.id, "page");
    const launch = `<button type="button" class="stg-btn tp-main" data-tp-main="${id}"`
      + ` title="Open in main chat" aria-label="Open in main chat">${ICON.toMain}</button>`;
    const badge = `<span class="badge st-${stOf(thread)}">${stateMark(glyphOf(thread))}`
      + `${isHeld(thread) ? heldBadge(thread.held) : wordOf(thread)}</span>`;
    const branch = thread.branch ? `<code class="tp-br" title="${esc(thread.branch)}">${ICON.branch}${esc(thread.branch)}</code>` : "";
    const html = launch + badge + rtTag(thread) + branch;
    const trigger = `<button type="button" class="stg-ic tw-more" data-tmenu="${id}" data-tmenu-in="page"`
      + ` aria-haspopup="menu" aria-expanded="${open}" title="Everything this thread can do"`
      + ` aria-label="Thread actions">${ICON.more}</button>`;
    const menu = `<span class="tp-menu-w">${trigger}${open ? threadMenuHtml(thread, "page") : ""}</span>`;
    if (markup === html + menu) return;
    redraw(head, html);
    redraw(actions, menu);
    markup = html + menu;
  }

  return { mount, draw };
}
