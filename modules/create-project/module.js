// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { PHONE } from "../../core/platform/viewport.js";
import { RM } from "../../core/ui/motion.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { initCreate } from "./create.js";

export function createProjectModule() {
  /** @type {Map<string, string>} */
  const descriptions = new Map();
  /** @type {ReturnType<typeof initCreate> | undefined} */
  let dialog;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.create-project", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "announce", "navigation", "conversationSession", "notices", "drawer"], contributes: ["conversation.press:create"] },
    activate(ctx) {
      const { localMessages } = ctx.use("conversationSession");
      dialog = initCreate({
        go: ctx.use("navigation").go, setDrawer: ctx.use("drawer").set, heraldShow: ctx.use("notices").show,
        world: ctx.use("world"), announce: ctx.use("announce"),
        welcome(id, description, text) {
          if (description) descriptions.set(id, description);
          localMessages.welcome("p:" + id, text);
        },
        onPhoneClose() {
          if (PHONE?.matches) ctx.timeout(() => requireHtml("#pb-menu", "button").focus({ preventScroll: true }), RM.matches ? 0 : 170);
        },
      }, ctx);
      ctx.effect(() => () => {
        dialog?.close({ now: true, restore: false });
        requireHtml("#create-dlg", "dialog").classList.remove("is-closing");
        dialog = undefined;
      });
      ctx.listen(requireHtml("#side-add", "button"), "click", dialog.open);
      ctx.contribute("conversation.press", pressEntry("create", valuePress("data-create", dialog.open, true)));
    },
  };
  return {
    module, descriptions, open: () => dialog?.open(), close: () => dialog?.close(), isOpen: () => dialog?.isOpen() ?? false,
  };
}
