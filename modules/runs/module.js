// @ts-check

import { $ } from "../../core/platform/dom.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { createRunsPage } from "./page.js";
import { createRunsStrip } from "./strip.js";
import { wireRunsGesture } from "../../shell/gestures.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @type {ModuleDef} */
export const runsModule = {
  manifest: {
    id: "xo.runs", version: "1.0.0", kernel: "^1.1.0", provides: ["runs"],
    needs: ["world", "announce", "stage", "shape", "conversationSession", "placeContext", "runControls", "notices", "decisionPresentation"],
    contributes: ["panel.page:runs", "thread.head:runs", "conversation.press:run"],
  },
  activate(ctx) {
    const world = ctx.use("world"), session = ctx.use("conversationSession"), place = ctx.use("placeContext");
    const strip = createRunsStrip({ world, SHAPE: ctx.use("shape") });
    const { pendingStops, stopsHerald } = ctx.use("runControls");
    const page = createRunsPage({
      world, stage: ctx.use("stage"), announce: ctx.use("announce"), pendingStops, stopsHerald,
      heraldShow: ctx.use("notices").show, commitMs: ctx.use("decisionPresentation").Kit.COMMIT_MS,
      transcript: session.folds, placeRegion: session.region, threadScroller: () => session.panel()?.C?.scroller,
      headFor: (opener) => session.conversationAt(opener) === session.main ? $("#thead") : $("#tpthead"),
    });
    ctx.effect(() => page.dispose);
    wireRunsGesture(page.card, () => page.isDetail, page.back, ctx.signal);
    ctx.contribute("panel.page", page.page);
    ctx.contribute("conversation.press", pressEntry("run", (target) => {
      const call = target.closest("[data-run-call]"), spawn = call?.getAttribute("data-run-call");
      const opener = spawn ? call : target.closest(".thead [data-run], .thead [data-runs]");
      if (!opener) return false;
      const thread = place.convThread(session.conversationAt(opener).view);
      const run = spawn ? [...world.state.runs.values()].find((candidate) => candidate.spawn === spawn)?.id ?? null
        : opener.getAttribute("data-run");
      void page.open(thread, run);
      return true;
    }));
    ctx.contribute("thread.head", { id: "runs", order: 20, render: strip.runsStrip });
    const close = () => { if (!page.isOpen) return false; page.back(); return true; };
    ctx.pushLayer({ id: "runs", open: () => page.isOpen, back: close, escape: close });
    ctx.provide("runs", { working: strip.workingRuns });
  },
};
