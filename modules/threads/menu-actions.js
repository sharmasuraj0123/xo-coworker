// @ts-check

import { $ } from "../../core/platform/dom.js";
import { focusOpened } from "../../core/ui/a11y/keynav.js";
import { createThreadMenuNavigation } from "./menu-navigation.js";

/** @import { ThreadMenuActions } from "./menu-actions-types.d.ts" */

/** @param {ThreadMenuActions} deps */
export function createThreadMenuActions(deps) {
  const { controls, editing, deletion, render, schedule, scope, resolve, openOtherRuntime, closePage, heraldShow } = deps;
  const { closeThreadMenu, startThreadEdit, saveThreadField, unfreeze } = editing;
  const navigate = createThreadMenuNavigation({
    thread: deps.thread, go: deps.go, showThread: deps.showThread,
    inStage: () => controls.menu()?.location === "page", closeMenu: () => closeThreadMenu({ focus: false }),
  });
  const focusDelete = () => $("[data-tdel-no]")?.focus({ preventScroll: true });

  /** @param {Element} target @param {MouseEvent} event */
  return function menuAction(target, event) {
    /** @param {string} attribute */
    const action = (attribute) => target.closest(`[${attribute}]`)?.getAttribute(attribute);
    const resolveButton = target.closest("[data-resolve]");
    const resolving = resolveButton?.getAttribute("data-resolve");
    if (resolveButton && resolving) { resolve(resolving, resolveButton.getAttribute("data-to") === "resolve"); return true; }
    const menuButton = target.closest("[data-tmenu]");
    const id = menuButton?.getAttribute("data-tmenu");
    if (menuButton && id) {
      const open = controls.toggleMenu(id, menuButton.getAttribute("data-tmenu-in") === "page" ? "page" : "main");
      render();
      const opened = menuButton.parentElement?.querySelector(".tw-menu");
      if (open && opened instanceof HTMLElement) focusOpened(opened, event);
      return true;
    }
    const menu = controls.menu();
    const field = action("data-tfield");
    if (navigate(target, event)) return true;
    const pageAction = menu?.location === "page"
      && (target.closest("[data-tfield]:not([data-tfield=clear-label])")
        || target.closest("[data-tdel]") || target.closest("[data-tmove]"));
    if (pageAction && menu) {
      closePage();
      controls.clearMenu();
      deps.go("t:" + menu.id);
      if (pageAction.hasAttribute("data-tdel")) { deletion.ask(menu.id); focusDelete(); }
      else if (field === "title" || field === "label") startThreadEdit(menu.id, field);
      else openOtherRuntime();
      return true;
    }
    const branch = action("data-tcopy");
    if (branch) {
      closeThreadMenu();
      navigator.clipboard?.writeText(branch).then(
        () => { if (!scope.signal.aborted) heraldShow({ kind: "done", text: "Branch name copied", sub: branch }, 2400); },
        () => { if (!scope.signal.aborted) heraldShow({ kind: "stopped", text: "Couldn't copy the branch name", sub: branch }, 4200); },
      );
      return true;
    }
    const deleting = action("data-tdel");
    if (deleting) {
      controls.clearMenu();
      deletion.ask(deleting);
      scope.frame(focusDelete);
      return true;
    }
    if (target.closest("[data-tdel-no]")) {
      const tid = deletion.cancel();
      $(`[data-tmenu="${CSS.escape(tid || "")}"]`)?.focus({ preventScroll: true });
      return true;
    }
    const confirm = action("data-tdel-yes");
    if (confirm) { deletion.confirm(confirm); return true; }
    if (target.closest("[data-tmove]")) {
      if (openOtherRuntime()) { controls.clearMenu(); schedule(); }
      else closeThreadMenu();
      return true;
    }
    const button = target.closest("[data-unfreeze]");
    const freezing = button?.getAttribute("data-unfreeze");
    if (freezing && button instanceof HTMLElement) { unfreeze(freezing, button); return true; }
    if (field && menu) {
      if (field === "clear-label") { closeThreadMenu(); saveThreadField(menu.id, "label", ""); }
      else if (field === "title" || field === "label") { controls.clearMenu(); startThreadEdit(menu.id, field); }
      return true;
    }
    if (menu && !target.closest(".tw-menu")) closeThreadMenu({ focus: false });
    return false;
  };
}
