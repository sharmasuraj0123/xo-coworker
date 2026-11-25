// @ts-check
import { createPendingRunStops } from "../../core/services/run-stops.js";
import { createConversationStops } from "./stops.js";
import { createRunningState } from "./running.js";

/** @import { StopDeps } from "./stop-types" */

/** @import { RunningDeps } from "./running-types" */

/** @typedef {Omit<StopDeps, "running" | "pendingStops"> & Omit<RunningDeps, "isStopping">} Options */

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "effect">} scope @param {Options} options */
export function mountRunControls(scope, options) {
  const pendingStops = createPendingRunStops();
  const stops = createConversationStops({ ...options, pendingStops, running: (view) => running(view) });
  const running = createRunningState({ ...options, isStopping: stops.isStopping });
  scope.effect(() => stops.dispose);
  return { ...stops, pendingStops, running };
}
