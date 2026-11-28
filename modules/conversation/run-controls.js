// @ts-check

/** @typedef {ReturnType<typeof mountRunControls>} RunControls */
import { createPendingRunStops } from "../../core/services/run-stops.js";
import { createConversationStops } from "./stops.js";
import { createRunningState } from "./running.js";

/** @import { StopDeps } from "./stop-types" */

/** @import { RunningDeps } from "./running-types" */

/** @typedef {Omit<StopDeps, "running" | "pendingStops"> & Omit<RunningDeps, "isStopping">} Options */

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "effect">} scope @param {Options} options */
function mountRunControls(scope, options) {
  const pendingStops = createPendingRunStops();
  const stops = createConversationStops({ ...options, pendingStops, running: (view) => running(view) });
  const running = createRunningState({ ...options, isStopping: stops.isStopping });
  scope.effect(() => stops.dispose);
  return { ...stops, pendingStops, running, workingRuns: options.workingRuns };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const runControlsModule = {
  manifest: { id: "xo.run-controls", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["runControls"], optional: ["runs"],
    needs: ["world", "decisionPresentation", "placeContext", "announce", "notices", "currentView", "chats", "conversationSession"] },
  activate(ctx) {
    const place = ctx.use("placeContext"), notices = ctx.use("notices");
    ctx.provide("runControls", mountRunControls(ctx, {
      world: ctx.use("world"), Kit: ctx.use("decisionPresentation").Kit, PROJ: place.PROJ, announce: ctx.use("announce"),
      schedule: () => ctx.invalidate("workspace"), chatOf: place.convProject, heraldShow: notices.show,
      workingRuns: (thread) => ctx.optional("runs")?.working(thread) ?? 0,
      view: ctx.use("currentView"), CH: ctx.use("chats"), convThread: place.convThread,
      inUse: ctx.use("conversationSession").focus.inUse, dismissStops: () => notices.dismiss((notice) => notice.tag === "stops"),
    }));
  },
};
