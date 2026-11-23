// @ts-check

import { $, $$ } from "../core/platform/dom.js";
import { esc } from "../core/platform/util.js";
import { xi } from "../core/ui/icons/icon.js";
import { ICON, XO } from "../core/ui/icons/names.js";

export function drawPlaceIcons() {
  $("#brand-mark").innerHTML = XO;
  $("#sc-ic").innerHTML = ICON.plus;
  $("#ic-home").innerHTML = ICON.home;
  $("#ic-ws").innerHTML = XO;
  $("#ic-chats").innerHTML = ICON.thread;
  $("#ic-arts").innerHTML = ICON.stack;
  $("#ic-lp").innerHTML = ICON.deploy;
  $("#ic-shells").innerHTML = ICON.shell;
}

/** @param {string} SHAPE_IC */
export function drawFrameIcons(SHAPE_IC) {
  $("#pb-menu").innerHTML = ICON.menu;
  $("#top-menu").innerHTML = ICON.menu;
  $("#side-x").innerHTML = ICON.close;
  $("#pn-x").innerHTML = ICON.close;
  $("#set-x").innerHTML = ICON.close;
  $("#set-side-ic").innerHTML = ICON.gear;
  {
    const IC = /** @type {Record<string, string>} */ ( { general: ICON.sliders, appearance: ICON.contrast, shape: SHAPE_IC, routing: ICON.router, runtimes: ICON.runtime, accounts: ICON.person, rules: ICON.rule, worktrees: ICON.branch, night: ICON.moon, sounds: ICON.sound, keys: ICON.key });
    for (const b of $$("[data-set]")) b.innerHTML = `<span class="sn-ic" aria-hidden="true">${IC[b.dataset.set] || ""}</span><span class="sn-t">${esc(b.textContent)}</span>`;
  }
  $("#set-phone").innerHTML = ICON.gear;
  $("#sound-tog .th-knob").innerHTML = ICON.sound;
  for (const x of $$(".sheet [data-close]")) x.innerHTML = ICON.close;
  $("#jump-ic").innerHTML = ICON.search;
  $("#all-ic").innerHTML = ICON.search;
}

export function drawSidebarControls() {
  $("#side-fold").innerHTML = ICON.sidebar;
  $("#side-jump").innerHTML = ICON.search;
  $("#ic-more").innerHTML = xi("dashboard");
  $("#nv-more .nr-chev").innerHTML = ICON.right;
}
