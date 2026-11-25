// @ts-check

// The phone's drawer: the sidebar slides over the page, with a scrim; closed, focus returns to its opener.

import { $ } from "../core/platform/dom.js";

/** @param {Pick<import("../core/kernel/types").ModuleContext, "listen">} scope @param {MediaQueryList} PHONE @param {() => void} syncInert */
export function createDrawer(scope, PHONE, syncInert) {
  /** @type {Element | null} */
  let drawerReturn = null;
  /** @param {boolean} open */
  function setDrawer(open) {
    if (!PHONE.matches && open) return;
    if (open) drawerReturn = document.activeElement;
    $("#app").classList.toggle("drawer", !!open);
    $("#side-scrim").hidden = !open;
    $("#pb-menu").setAttribute("aria-expanded", String(!!open));
    $("#top-menu").setAttribute("aria-expanded", String(!!open));
    syncInert();
    if (open) $("#nv-home").focus();
    else if ($("#side").contains(document.activeElement) || document.activeElement === document.body) {
      const back = [drawerReturn, $("#top-menu"), $("#pb-menu")].find((b) => b instanceof HTMLElement
        && b.isConnected && b.offsetParent && !b.closest("[inert]"));
      if (PHONE.matches) back?.focus({ preventScroll: true });
    }
  }
  for (const selector of ["#pb-menu", "#top-menu"]) scope.listen($(selector), "click", () => setDrawer(true));
  for (const selector of ["#side-x", "#side-scrim", "#nv-shells"]) scope.listen($(selector), "click", () => setDrawer(false));
  return setDrawer;
}
