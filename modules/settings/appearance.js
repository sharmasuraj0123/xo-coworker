// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";
import { STONE, FLAVOURS } from "../../core/ui/flavours.js";

/** @param {import("./types").AppearanceDeps} deps */
export function wireAppearance({ THEME, applyTheme, deviceSaid }) {
  const MODES = [["dark", "Dark"], ["light", "Light"], ["system", "System"]];
  const LOOKS = [[STONE.id, STONE.name], ...FLAVOURS.map((f) => [f.id, f.name])];
  $("#mode-seg").innerHTML = MODES.map(([v, n]) => `<button type="button" role="radio" aria-checked="false" data-mode="${v}">${esc(n)}</button>`).join("");
  $("#flavour-seg").innerHTML = LOOKS.map(([v, n]) => `<button type="button" class="set-choice fl-opt" role="radio" aria-checked="false" data-flavour="${v}"><span class="fl-sw" data-sw="${v}" aria-hidden="true"></span><span class="fl-n">${esc(n)}</span></button>`).join("");
  radioKeys($("#mode-seg")); radioKeys($("#flavour-seg"));
  function lookSync() {
    for (const [id, now] of [["#mode-seg", THEME.pref()], ["#flavour-seg", THEME.flavour()]]) {
      for (const b of $(id).querySelectorAll('[role="radio"]')) { const on = (b.dataset.mode || b.dataset.flavour) === now; b.setAttribute("aria-checked", String(on)); b.classList.toggle("is-on", on); b.tabIndex = on ? 0 : -1; }
    }
  }
  /** @param {string} key @param {string} v */
  function lookSet(key, v) {
    let kept = true;
    try { localStorage.setItem(key, v); } catch { kept = false; }
    applyTheme(THEME.get());
    lookSync();
    return { kept };
  }
  $("#mode-seg").addEventListener("click", (/** @type {MouseEvent} */ e) => {
    const b = /** @type {(HTMLElement & { dataset: { mode: string } }) | null} */ ((/** @type {HTMLElement} */ (e.target)).closest("[data-mode]"));
    if (b) deviceSaid(b, lookSet("cv-theme", b.dataset.mode), `${/** @type {string[]} */ (MODES.find(([v]) => v === b.dataset.mode))[1]} mode`);
  });
  $("#flavour-seg").addEventListener("click", (/** @type {MouseEvent} */ e) => {
    const b = /** @type {(HTMLElement & { dataset: { flavour: string } }) | null} */ ((/** @type {HTMLElement} */ (e.target)).closest("[data-flavour]"));
    if (b) deviceSaid(b, lookSet("cv-flavour", b.dataset.flavour), `${/** @type {string[]} */ (LOOKS.find(([v]) => v === b.dataset.flavour))[1]} flavour`);
  });
  lookSync();
  return { lookSync };
}

/** @import { AppearanceShape, DeviceNotice } from "./types.d.ts" */

/** @param {AppearanceShape} SHAPE @param {string} WEBPICS @param {DeviceNotice} deviceSaid */
export function wireWebPictures(SHAPE, WEBPICS, deviceSaid) {
  function webpicsRender() { $("#webpics-tog").setAttribute("aria-checked", String(SHAPE.on(WEBPICS))); }
  $("#webpics-tog").addEventListener("click", (/** @type {Event} */ e) => {
    // A picture's site learns someone looked, so each device decides.
    const on = !SHAPE.on(WEBPICS);
    deviceSaid(/** @type {Element} */ (e.currentTarget), SHAPE.setDevice({ surfaces: { [WEBPICS]: { on } } }), on ? "Pictures from the web show in the conversation." : "Pictures from the web show as links.");
  });
  return webpicsRender;
}

/** @param {{ readonly showHops?: boolean }} S @param {AppearanceShape} SHAPE @param {DeviceNotice} deviceSaid */
export function wireMessageHops(S, SHAPE, deviceSaid) {
  function hopsRender() { $("#hops-tog").setAttribute("aria-checked", String(!!S.showHops)); }
  $("#hops-tog").addEventListener("click", (/** @type {Event} */ e) => {
    const on = !S.showHops;
    deviceSaid(/** @type {Element} */ (e.currentTarget), SHAPE.setDevice({ surfaces: { "xo:thread/hops": { on } } }), on ? "Showing how messages travel." : "Hiding how messages travel.");
  });
  hopsRender();
  return hopsRender;
}

/** @param {DeviceNotice} deviceSaid */
export function wireChatBubbles(deviceSaid) {
  const chatBubbles = () => document.documentElement.dataset.msgx === "bubbles";
  /** @param {boolean} on */
  function setChatBubbles(on) {
    const r = document.documentElement;
    if (on) { r.dataset.msgx = "bubbles"; r.dataset.msgxTails = ""; } else { delete r.dataset.msgx; delete r.dataset.msgxTails; }
    let kept = true;
    try { localStorage.setItem("cv-bubbles", on ? "on" : "off"); } catch { kept = false; }
    return { on, kept };
  }
  function bubblesRender() { $("#bubbles-tog").setAttribute("aria-checked", String(chatBubbles())); }
  $("#bubbles-tog").addEventListener("click", (/** @type {Event} */ e) => {
    const r = setChatBubbles(!chatBubbles());
    bubblesRender();
    deviceSaid(/** @type {Element} */ (e.currentTarget), r, r.on ? "Messages show in bubbles." : "Replies read as full-width documents.");
  });
  bubblesRender();
}
