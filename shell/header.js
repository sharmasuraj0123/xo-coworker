// @ts-check

// The header's buttons that come from the header.action place (an app's), drawn as XO's own and pressed through their entry.

import { esc } from "../core/platform/index.js";
import { xi, hasIcon } from "../core/ui/icons/icon.js";

/** @typedef {import("../core/kernel/types").Kernel["places"]} Places @typedef {import("../core/kernel/types").At} At */

/** @typedef {import("../core/kernel/types").Entry & { label: string, icon: string, onPress(at: At): void }} Action */

/** The buttons for where you are, in the place's order. @param {Places} places @param {At} at */
export function headerActionsHtml(places, at) {
  /** @type {Action[]} */
  const actions = places.entries("header.action", at);
  return actions.map((e) =>
    `<button type="button" class="tw-act" data-header-action="${esc(e.id)}" title="${esc(e.label)}">${hasIcon(e.icon) ? xi(e.icon) : ""}<span>${esc(e.label)}</span></button>`).join("");
}

/** @param {Pick<import("../core/kernel/types").ModuleContext, "listen">} scope @param {Places} places @param {() => At} at */
export function wireHeaderActions(scope, places, at) {
  scope.listen(document, "click", ({ target }) => {
    const id = target instanceof Element && target.closest("[data-header-action]")?.getAttribute("data-header-action");
    if (!id) return;
    /** @type {Action | undefined} */
    const action = places.get("header.action", id);
    action?.onPress(at());
  });
}
