// @ts-check
import { createProjectIconChoice } from "./icon-choice.js";
import { createProjectIconPicker } from "./icon-picker.js";

/** @import { IconHost } from "./icon-picker-types.d.ts" */

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "effect" | "listen">} scope @param {IconHost} host */
function mountProjectIcons(scope, host) {
  const { ownIcon, ownTint, projectTint, projectIcon, forgetIcon } = createProjectIconChoice(host);
  const { PICK, pickIcon, closePick } = createProjectIconPicker({ ...host, ownIcon, ownTint, forgetIcon });
  scope.effect(() => closePick);
  scope.listen(document, "click", ({ target }) => {
    const button = target instanceof Element ? target.closest("[data-pj-icon]") : null;
    const id = button?.getAttribute("data-pj-icon");
    if (id != null && button instanceof HTMLElement) pickIcon(id, button);
  });
  scope.listen(document, "pointerdown", ({ target }) => {
    if (PICK.el && target instanceof Element && !target.closest(".pk-pop,[data-pj-icon]")) closePick();
  });
  return { PICK, projectIcon, projectTint };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const projectIconsModule = {
  manifest: { id: "xo.project-icons", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "shape", "projectName", "announce"], provides: ["projectIcons"] },
  activate(ctx) {
    ctx.provide("projectIcons", mountProjectIcons(ctx, {
      world: ctx.use("world"), SHAPE: ctx.use("shape"), PROJ: ctx.use("projectName"),
      announce: ctx.use("announce"), render: () => ctx.emit("app:render"),
    }));
  },
};
