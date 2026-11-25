// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { write } from "../../core/platform/storage.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";
import { STONE, FLAVOURS } from "../../core/ui/flavours.js";

/** @import { PreferenceScope } from "./appearance-types.d.ts" */

/** @param {PreferenceScope} scope @param {import("./appearance-types.d.ts").AppearanceDeps} deps */
export function wireAppearance(scope, { THEME, deviceSaid }) {
  const MODES = [["dark", "Dark"], ["light", "Light"], ["system", "System"]];
  const LOOKS = [[STONE.id, STONE.name], ...FLAVOURS.map((f) => [f.id, f.name])];
  $("#mode-seg").innerHTML = MODES.map(([v, n]) => `<button type="button" role="radio" aria-checked="false" data-mode="${v}">${esc(n)}</button>`).join("");
  $("#flavour-seg").innerHTML = LOOKS.map(([v, n]) => `<button type="button" class="set-choice fl-opt" role="radio" aria-checked="false" data-flavour="${v}"><span class="fl-sw" data-sw="${v}" aria-hidden="true"></span><span class="fl-n">${esc(n)}</span></button>`).join("");
  for (const group of [$("#mode-seg"), $("#flavour-seg")]) scope.effect(() => radioKeys(group));
  function lookSync() {
    for (const [id, now] of [["#mode-seg", THEME.pref()], ["#flavour-seg", THEME.flavour()]]) {
      for (const b of $(id).querySelectorAll('[role="radio"]')) { const on = (b.dataset.mode || b.dataset.flavour) === now; b.setAttribute("aria-checked", String(on)); b.classList.toggle("is-on", on); b.tabIndex = on ? 0 : -1; }
    }
  }
  /** @param {"cv-theme" | "cv-flavour"} key @param {string} value */
  function lookSet(key, value) { return THEME.set(key, value); }
  scope.effect(() => THEME.onChange(lookSync));
  scope.listen($("#mode-seg"), "click", (e) => {
    const b = /** @type {(HTMLElement & { dataset: { mode: string } }) | null} */ ((/** @type {HTMLElement} */ (e.target)).closest("[data-mode]"));
    if (b) deviceSaid(b, lookSet("cv-theme", b.dataset.mode), `${/** @type {string[]} */ (MODES.find(([v]) => v === b.dataset.mode))[1]} mode`);
  });
  scope.listen($("#flavour-seg"), "click", (e) => {
    const b = /** @type {(HTMLElement & { dataset: { flavour: string } }) | null} */ ((/** @type {HTMLElement} */ (e.target)).closest("[data-flavour]"));
    if (b) deviceSaid(b, lookSet("cv-flavour", b.dataset.flavour), `${/** @type {string[]} */ (LOOKS.find(([v]) => v === b.dataset.flavour))[1]} flavour`);
  });
  lookSync();
}

/** @import { AppearanceShape, DeviceNotice } from "./appearance-types.d.ts" */

/** @param {PreferenceScope} scope @param {AppearanceShape} SHAPE @param {string} WEBPICS @param {DeviceNotice} deviceSaid */
export function wireWebPictures(scope, SHAPE, WEBPICS, deviceSaid) {
  function webpicsRender() { $("#webpics-tog").setAttribute("aria-checked", String(SHAPE.on(WEBPICS))); }
  scope.listen($("#webpics-tog"), "click", (/** @type {Event} */ e) => {
    // A picture's site learns someone looked, so each device decides.
    const on = !SHAPE.on(WEBPICS);
    deviceSaid(/** @type {Element} */ (e.currentTarget), SHAPE.setDevice({ surfaces: { [WEBPICS]: { on } } }), on ? "Pictures from the web show in the conversation." : "Pictures from the web show as links.");
  });
  return webpicsRender;
}

/** @param {PreferenceScope} scope @param {AppearanceShape} SHAPE @param {DeviceNotice} deviceSaid */
export function wireMessageHops(scope, SHAPE, deviceSaid) {
  function hopsRender() { $("#hops-tog").setAttribute("aria-checked", String(SHAPE.on("xo:thread/hops"))); }
  scope.listen($("#hops-tog"), "click", (/** @type {Event} */ e) => {
    const on = !SHAPE.on("xo:thread/hops");
    deviceSaid(/** @type {Element} */ (e.currentTarget), SHAPE.setDevice({ surfaces: { "xo:thread/hops": { on } } }), on ? "Showing how messages travel." : "Hiding how messages travel.");
  });
  hopsRender();
  return hopsRender;
}

/** @param {PreferenceScope} scope @param {DeviceNotice} deviceSaid */
export function wireChatBubbles(scope, deviceSaid) {
  const chatBubbles = () => document.documentElement.dataset.msgx === "bubbles";
  /** @param {boolean} on */
  function setChatBubbles(on) {
    const r = document.documentElement;
    if (on) { r.dataset.msgx = "bubbles"; r.dataset.msgxTails = ""; } else { delete r.dataset.msgx; delete r.dataset.msgxTails; }
    return { on, ...write("cv-bubbles", on ? "on" : "off") };
  }
  function bubblesRender() { $("#bubbles-tog").setAttribute("aria-checked", String(chatBubbles())); }
  scope.listen($("#bubbles-tog"), "click", (/** @type {Event} */ e) => {
    const r = setChatBubbles(!chatBubbles());
    bubblesRender();
    deviceSaid(/** @type {Element} */ (e.currentTarget), r, r.on ? "Messages show in bubbles." : "Replies read as full-width documents.");
  });
  bubblesRender();
}
