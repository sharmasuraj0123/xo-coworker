// @ts-check
import { ownLayer } from "../../shell/layers.js";
import { requireHtml } from "../../core/platform/dom.js";
import { PHONE } from "../../core/platform/viewport.js";
import { RM } from "../../core/ui/motion.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { initCreate } from "./create.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const projectDescriptionsModule = {
  manifest: { id: "xo.project-descriptions", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["projectDescriptions"] },
  activate(ctx) {
    /** @type {Map<string, string>} */
    const descriptions = new Map();
    ctx.provide("projectDescriptions", descriptions);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const createProjectModule = {
  manifest: { id: "xo.create-project", version: "1.0.0", kernel: "^1.1.0", provides: ["createProject"],
    needs: ["world", "announce", "navigation", "conversationSession", "notices", "drawer", "projectDescriptions"],
    contributes: ["conversation.press:create"] },
  activate(ctx) {
    const { localMessages } = ctx.use("conversationSession");
    const descriptions = ctx.use("projectDescriptions");
    const dialog = initCreate({
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
      dialog.close({ now: true, restore: false });
      requireHtml("#create-dlg", "dialog").classList.remove("is-closing");
    });
    ownLayer(ctx, { id: "create", open: dialog.isOpen, close: () => { dialog.close(); } });
    ctx.provide("createProject", dialog);
    ctx.listen(requireHtml("#side-add", "button"), "click", dialog.open);
    ctx.contribute("conversation.press", pressEntry("create", valuePress("data-create", dialog.open, true)));
  },
};
