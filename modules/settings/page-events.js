// @ts-check

import { createScope } from "../../core/kernel/scope.js";

/** @import { SettingsPage } from "./host-types.d.ts" */

/** @import { ModuleContext } from "../../core/kernel/types" */

export const SETTINGS_PAGE_OPEN = "settings:page-open";

/** @param {ModuleContext} context @param {HTMLElement} root */
export function settingsPageEvents(context, root) {
  /** @param {string} id @param {SettingsPage} page */
  return function bindPage(id, page) {
    const scope = createScope();
    scope.effect(() => context.on(SETTINGS_PAGE_OPEN, (pageId) => { if (pageId === id) void page.open(); }));
    /** @param {EventTarget | null} target */
    const owns = (target) => target instanceof Element && target.closest("[data-page]")?.getAttribute("data-page") === id;
    scope.listen(root, "click", ({ target }) => {
      if (!(target instanceof Element) || !owns(target) || page.clickFirst?.(target)) return;
      if (!target.closest('[aria-disabled="true"]')) page.click(target);
    });
    if (page.change) scope.listen(root, "change", ({ target }) => {
      if (target instanceof Element && owns(target)) page.change?.(target);
    });
    if (page.submit) scope.listen(root, "submit", (event) => { if (owns(event.target)) page.submit?.(event); });
    return scope.dispose;
  };
}
