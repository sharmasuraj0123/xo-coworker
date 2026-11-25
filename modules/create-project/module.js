// @ts-check
import { $ } from "../../core/platform/dom.js";
import { RM } from "../../core/ui/motion.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { initCreate } from "./create.js";

/** @import { CreateCtx } from "./types" */

/** @typedef {Pick<CreateCtx, "go" | "heraldShow" | "setDrawer">} ProjectActions */

/** @typedef {ProjectActions & { phone: MediaQueryList, welcome(view: string, text: string): void }} Host */

/** @param {Host} host */
export function createProjectModule(host) {
  /** @type {Map<string, string>} */
  const descriptions = new Map();
  /** @type {ReturnType<typeof initCreate> | undefined} */
  let dialog;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.create-project", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "announce"], contributes: ["conversation.press:create"] },
    activate(ctx) {
      dialog = initCreate({
        ...host, world: ctx.use("world"), announce: ctx.use("announce"),
        welcome(id, description, text) {
          if (description) descriptions.set(id, description);
          host.welcome("p:" + id, text);
        },
        onPhoneClose() {
          if (host.phone.matches) ctx.timeout(() => $("#pb-menu").focus({ preventScroll: true }), RM.matches ? 0 : 170);
        },
      }, ctx);
      ctx.effect(() => () => {
        dialog?.close({ now: true, restore: false });
        $("#create-dlg").classList.remove("is-closing");
        dialog = undefined;
      });
      ctx.listen($("#side-add"), "click", dialog.open);
      ctx.contribute("conversation.press", pressEntry("create", valuePress("data-create", dialog.open, true)));
    },
  };
  return {
    module, descriptions, open: () => dialog?.open(), close: () => dialog?.close(), isOpen: () => dialog?.isOpen() ?? false,
  };
}
