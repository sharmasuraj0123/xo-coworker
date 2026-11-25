// @ts-check
import { $ } from "../../core/platform/dom.js";
import { createScope } from "../../core/kernel/scope.js";
import { pageEl, sessionOf } from "../../shell/place-context.js";
import { createWorkspaceJump } from "./jump-items.js";

/** @import { JumpHost } from "./jump-items-types" */

/** @param {JumpHost} host */
export function createJumpModule(host) {
  const el = $("#jump");
  /** @type {ReturnType<typeof createWorkspaceJump> | undefined} */
  let jump;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.jump", version: "1.0.0", kernel: "^1.1.0",
      needs: ["currentView", "placeContext", "threadPresentation", "decisionPresentation", "announce"] },
    activate(ctx) {
      const scope = createScope(), view = ctx.use("currentView");
      const session = () => sessionOf(view());
      ctx.effect(() => () => { jump?.close(); scope.dispose(); jump = undefined; });
      jump = createWorkspaceJump({
        ...host, host: el, sources: ctx.places, announce: ctx.use("announce"),
        items: { ...ctx.use("placeContext"), ...ctx.use("threadPresentation"), D: ctx.use("decisionPresentation").D,
          projectIcon: host.projectIcon },
        actions: { ...host, theme: () => $("#theme").click(), stage: () => !pageEl(view()),
          intelligence: () => !!host.IQ.kindOf(session()), openIntelligence: () => host.IQ.open(session(), $("#iq")) },
      }, scope);
    },
  };
  return { module, el, open: () => jump?.open(), close: () => jump?.close() };
}
