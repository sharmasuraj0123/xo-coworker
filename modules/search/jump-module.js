// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { createScope } from "../../core/kernel/scope.js";
import { pageEl, sessionOf } from "../../shell/place-context.js";
import { createWorkspaceJump } from "./jump-items.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const jumpModule = {
  manifest: { id: "xo.jump", version: "1.0.0", kernel: "^1.1.0", provides: ["jump"],
    needs: ["currentView", "placeContext", "threadPresentation", "decisionPresentation", "announce", "overlayFocus", "navigation",
      "intelligence", "projectIcons", "stage", "shortcuts"], optional: ["createProject", "settingsFrame"] },
  activate(ctx) {
    const scope = createScope(), view = ctx.use("currentView"), el = requireHtml("#jump");
    ctx.effect(() => scope.dispose);
    const session = () => sessionOf(view()), { intelligence } = ctx.use("intelligence");
    const shortcuts = ctx.use("shortcuts"), stage = ctx.use("stage");
    const jump = createWorkspaceJump({
      host: el, sources: ctx.places, announce: ctx.use("announce"), focusIn: ctx.use("overlayFocus"),
      onHidden: () => ctx.emit("app:sync-inert"), go: ctx.use("navigation").go,
      items: { ...ctx.use("placeContext"), ...ctx.use("threadPresentation"), D: ctx.use("decisionPresentation").D,
        projectIcon: ctx.use("projectIcons").projectIcon },
      actions: {
        create: () => ctx.optional("createProject")?.open(), settings: () => ctx.optional("settingsFrame")?.open(), keys: shortcuts.openKeys,
        theme: () => requireHtml("#theme", "button").click(), stage: () => !pageEl(view()), toggleStage: () => stage.toggle(),
        intelligence: () => !!intelligence.kindOf(session()), openIntelligence: () => intelligence.open(session(), requireHtml("#iq", "button")),
      },
    }, scope);
    ctx.effect(() => jump.close);
    ctx.provide("jump", jump);
  },
};
