// @ts-check

import { requireHtml } from "../../core/platform/dom.js";
import * as K from "../../core/platform/keys.js";
import { keysSheetRender } from "./keys-sheet.js";

/** @typedef {Pick<import("../../core/kernel/types").ModuleContext, "listen" | "effect">} Scope */

/** @param {Scope} scope @param {(el: HTMLElement) => void} focusOverlay @param {() => void} syncInert @param {() => void} schedule */
export function createShortcutsSheet(scope, focusOverlay, syncInert, schedule) {
  const keys = requireHtml("#keys");
  const closeButton = requireHtml("[data-close]", "button", keys);
  /** @type {HTMLElement | null} */
  let returnTo = null;
  function openKeys() {
    keysSheetRender();
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keys.hidden = false;
    focusOverlay(closeButton);
  }
  function closeKeys() {
    keys.hidden = true;
    syncInert();
    returnTo?.focus({ preventScroll: true });
  }
  scope.listen(keys, "click", ({ target }) => {
    if (target === keys || (target instanceof Element && target.closest("[data-close]"))) closeKeys();
  });
  scope.effect(() => K.onChange(() => { if (!keys.hidden) keysSheetRender(); schedule(); }));
  return { keys, openKeys, closeKeys };
}
