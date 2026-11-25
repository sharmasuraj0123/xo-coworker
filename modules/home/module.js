// @ts-check
import { skTile, bar, rememberedMade } from "./skeleton.js";
import { requireHtml } from "../../core/platform/dom.js";
import { createScope } from "../../core/kernel/scope.js";
import { convOfChat } from "../../shell/place-context.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { createHomeController } from "./controller.js";

/** @typedef {ReturnType<import("../../core/kernel/types").Services["decisionPresentation"]["D"]["needItems"]>[number]} Need */

/** @typedef {import("./controller-types").HomeControllerOptions<Need>} Options */

/** @param {Pick<Options, "threadMark" | "noun" | "SV" | "decideKey" | "heraldShow" | "kernel">} host */
export function createHomeModule(host) {
  /** @type {ReturnType<typeof createHomeController<Need>> | undefined} */
  let controller;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.home", version: "1.0.0", kernel: "^1.1.0", contributes: ["conversation.press:next"],
      needs: ["world", "currentView", "announce", "placeContext", "decisionPresentation", "threadPresentation"] },
    activate(ctx) {
      const scope = createScope();
      const view = ctx.use("currentView"), el = requireHtml("#home");
      ctx.effect(() => () => { controller = undefined; scope.dispose(); el.replaceChildren(); });
      const home = createHomeController({
        ...host, ...ctx.use("decisionPresentation"), scope, host: el, world: ctx.use("world"), announce: ctx.use("announce"),
        convOfChat, isBusy: ctx.use("threadPresentation").isBusy, PROJ: ctx.use("placeContext").PROJ,
        schedule: () => ctx.invalidate("workspace"), isCurrent: () => view() === "home",
      });
      controller = home;
      ctx.on("app:decision-undone", (key) => { if (view() === "home") home.restore(key); });
      ctx.contribute("conversation.press", pressEntry("next", valuePress("data-next", () => home.openNext(), true)));
      ctx.invalidate("workspace");
    },
  };
  return { module,
    /** @param {Need[]} needs */
    homeParts: (needs) => ({ held: controller?.homeParts(needs).held ?? [] }),
    /** @param {Need[]} needs */
    homeRender: (needs) => controller?.homeRender(needs),
  };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const homeSkeletonModule = {
  manifest: { id: "xo.home-skeleton", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["homeSkeleton"] },
  activate(ctx) { ctx.provide("homeSkeleton", { skTile, skBar: bar, rememberedMade }); },
};
