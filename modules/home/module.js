// @ts-check
import { skTile, bar, rememberedMade } from "./skeleton.js";
import { requireHtml } from "../../core/platform/dom.js";
import { convOfChat } from "../../shell/place-context.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { createHomeController } from "./controller.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const homeModule = {
  manifest: { id: "xo.home", version: "1.0.0", kernel: "^1.1.0", contributes: ["conversation.press:next", "page:home"], provides: ["home"],
    needs: ["world", "currentView", "announce", "placeContext", "decisionPresentation", "threadPresentation", "conversationPresentation",
      "shapeView", "threadRuntime", "notices", "decisionDock"] },
  activate(ctx) {
    const view = ctx.use("currentView"), el = requireHtml("#home");
    ctx.effect(() => () => el.replaceChildren());
    const home = createHomeController({
      ...ctx.use("decisionPresentation"), scope: ctx, host: el, places: ctx.places, world: ctx.use("world"), announce: ctx.use("announce"),
      convOfChat, isBusy: ctx.use("threadPresentation").isBusy, PROJ: ctx.use("placeContext").PROJ,
      threadMark: ctx.use("threadRuntime").threadMark, noun: ctx.use("conversationPresentation").noun, SV: ctx.use("shapeView"),
      heraldShow: ctx.use("notices").show, decideKey: ctx.use("decisionDock").decideKey,
      schedule: () => ctx.invalidate("workspace"), isCurrent: () => view() === "home",
    });
    ctx.on("app:decision-undone", (key) => { if (view() === "home") home.restore(key); });
    ctx.contribute("conversation.press", pressEntry("next", valuePress("data-next", home.openNext, true)));
    ctx.contribute("page", { id: "home", render: (_host, needs) => home.homeRender(needs) });
    ctx.provide("home", home);
    ctx.invalidate("workspace");
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const homeSkeletonModule = {
  manifest: { id: "xo.home-skeleton", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["homeSkeleton"] },
  activate(ctx) { ctx.provide("homeSkeleton", { skTile, skBar: bar, rememberedMade }); },
};
