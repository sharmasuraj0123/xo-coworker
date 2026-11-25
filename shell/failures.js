// @ts-check
import { mountFailureSurface } from "./failure-surface.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const failureModule = {
  manifest: { id: "xo.failure-notices", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["notices"] },
  activate(ctx) {
    const surface = mountFailureSurface(ctx);
    ctx.listen(window, "error", (event) => {
      const error = /** @type {ErrorEvent} */ (event);
      surface.report(error.error ?? error.message, "Application error");
    });
    ctx.listen(window, "unhandledrejection", (event) => {
      surface.report(/** @type {PromiseRejectionEvent} */ (event).reason, "Application error");
    });
    ctx.on("app:started", (report) => {
      const failed = (/** @type {{id: string, error: string}} */ failure) => surface.report(failure.error, failure.id);
      report.failed.forEach(failed);
      ctx.on("kernel:module-failed", failed);
    });
  },
};
