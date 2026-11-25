// @ts-check
import { createProjectIconChoice } from "./icon-choice.js";
import { createProjectIconPicker } from "./icon-picker.js";

/** @import { IconHost } from "./icon-picker-types.d.ts" */

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "effect" | "listen">} scope @param {IconHost} host */
export function mountProjectIcons(scope, host) {
  const { ownIcon, projectIcon, forgetIcon } = createProjectIconChoice(host);
  const { PICK, pickIcon, closePick } = createProjectIconPicker({ ...host, ownIcon, forgetIcon });
  scope.effect(() => closePick);
  scope.listen(document, "click", ({ target }) => {
    const button = target instanceof Element ? target.closest("[data-pj-icon]") : null;
    const id = button?.getAttribute("data-pj-icon");
    if (id != null && button instanceof HTMLElement) pickIcon(id, button);
  });
  scope.listen(document, "pointerdown", ({ target }) => {
    if (PICK.el && target instanceof Element && !target.closest(".pk-pop,[data-pj-icon]")) closePick();
  });
  return { PICK, projectIcon };
}
