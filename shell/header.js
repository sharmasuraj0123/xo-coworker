// @ts-check

// The header's buttons that come from the header.action place (an app's), drawn as XO's own and pressed through their entry.

import { esc } from "../core/platform/index.js";

/** @typedef {import("../core/kernel/types").Kernel["places"]} Places @typedef {import("../core/kernel/types").At} At */

/** The buttons for where you are, in the place's order; icon draws one by its name. @param {Places} places @param {At} at @param {(name: string) => string} icon */
export function headerActionsHtml(places, at, icon) {
  return places.entries("header.action", at).map((/** @type {any} */ e) =>
    `<button type="button" class="tw-act" data-header-action="${esc(e.id)}" title="${esc(e.label)}">${icon(e.icon)}<span>${esc(e.label)}</span></button>`).join("");
}

/** A press on one runs its entry's onPress with where you are. @param {Places} places @param {() => At} at @param {Pick<Document, "addEventListener">} [root] */
export function wireHeaderActions(places, at, root = document) {
  root.addEventListener("click", (e) => {
    const b = /** @type {any} */ (e.target)?.closest?.("[data-header-action]");
    if (b) /** @type {any} */ (places.get("header.action", b.dataset.headerAction))?.onPress(at());
  });
}
