// @ts-check

import { $$, requireHtml } from "../core/platform/dom.js";
import { esc } from "../core/platform/util.js";
import { ICON, XO } from "../core/ui/icons/names.js";

export function drawPlaceIcons() {
  requireHtml("#brand-mark").innerHTML = XO;
  requireHtml("#sc-ic").innerHTML = ICON.plus;
  requireHtml("#ic-home").innerHTML = ICON.home;
  requireHtml("#ic-ws").innerHTML = XO;
  requireHtml("#ic-chats").innerHTML = ICON.thread;
  requireHtml("#ic-arts").innerHTML = ICON.stack;
  requireHtml("#ic-lp").innerHTML = ICON.deploy;
  requireHtml("#ic-shells").innerHTML = ICON.shell;
}

export function drawFrameIcons() {
  requireHtml("#pb-menu", "button").innerHTML = ICON.menu;
  requireHtml("#top-menu", "button").innerHTML = ICON.menu;
  requireHtml("#side-x", "button").innerHTML = ICON.close;
  requireHtml("#pn-x", "button").innerHTML = ICON.close;
  requireHtml("#set-x", "button").innerHTML = ICON.close;
  requireHtml("#set-side-ic").innerHTML = ICON.gear;
  {
    const IC = /** @type {Record<string, string>} */ ( { general: ICON.sliders, appearance: ICON.contrast, shape: ICON.shape, routing: ICON.router, runtimes: ICON.runtime, accounts: ICON.person, rules: ICON.rule, worktrees: ICON.branch, night: ICON.moon, keys: ICON.key });
    for (const b of $$("[data-set]")) b.innerHTML = `<span class="sn-ic" aria-hidden="true">${IC[b.getAttribute("data-set") || ""] || ""}</span><span class="sn-t">${esc(b.textContent)}</span>`;
  }
  requireHtml("#set-phone", "button").innerHTML = ICON.gear;
  for (const x of $$(".sheet [data-close]")) x.innerHTML = ICON.close;
  requireHtml("#jump-ic").innerHTML = ICON.search;
}

export function drawSidebarControls() {
  requireHtml("#side-fold", "button").innerHTML = ICON.sidebar;
  requireHtml("#side-jump", "button").innerHTML = ICON.search;
  requireHtml("#ic-more").innerHTML = ICON.more;
  requireHtml("#nv-more .nr-chev").innerHTML = ICON.right;
}
