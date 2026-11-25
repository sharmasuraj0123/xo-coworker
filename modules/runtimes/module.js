// @ts-check
import { createThreadRuntime } from "./thread.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const threadRuntimeModule = {
  manifest: { id: "xo.thread-runtime", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "shape", "threadPresentation"], provides: ["threadRuntime"] },
  activate(ctx) {
    ctx.provide("threadRuntime", createThreadRuntime({
      world: ctx.use("world"), SHAPE: ctx.use("shape"), isHeld: ctx.use("threadPresentation").isHeld,
    }));
  },
};
