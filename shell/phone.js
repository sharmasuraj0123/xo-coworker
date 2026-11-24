// @ts-check

// The phone's drawer: the sidebar slides over the page, with a scrim; closed, focus returns to its opener.

import { $ } from "../core/platform/dom.js";

/** The drawer's open and close, wired to its buttons. @param {{ phone: MediaQueryList, syncInert: () => void }} deps @returns {(open: boolean) => void} */
export function createDrawer({ phone: PHONE, syncInert }) {
  /** @type {any} */
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
      const back = [drawerReturn, $("#top-menu"), $("#pb-menu")].find((/** @type {any} */ b) => b && b.isConnected && b.offsetParent && !b.closest("[inert]"));
      if (PHONE.matches) back?.focus({ preventScroll: true });
    }
  }
  $("#pb-menu").addEventListener("click", () => setDrawer(true));
  $("#top-menu").addEventListener("click", () => setDrawer(true));
  $("#side-x").addEventListener("click", () => setDrawer(false));
  $("#side-scrim").addEventListener("click", () => setDrawer(false));
  // on a phone the shells open as a sheet over everything: the sidebar they were opened from steps aside
  $("#nv-shells").addEventListener("click", () => setDrawer(false));
  return setDrawer;
}
