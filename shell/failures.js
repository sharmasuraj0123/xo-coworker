// @ts-check
import { createFailureSurface } from "../core/platform/failure.js";
import { mountFailurePresenter } from "./failure-surface.js";

/** @typedef {Parameters<typeof createFailureSurface>[0]} Present */

/** @typedef {{ show: Present, schedule: (flush: () => void) => void }} Presenter */

export function createFailureReporting() {
  /** @type {Presenter | undefined} */
  let presenter;
  /** @type {Parameters<Present>[0] | undefined} */
  let startupNotice;
  /** @returns {ReturnType<typeof createFailureSurface>} */
  function createPolicy() {
    const policy = createFailureSurface((notice) => {
      if (surface !== policy) return;
      if (presenter) presenter.show(notice);
      else startupNotice = notice;
    }, (flush) => presenter ? presenter.schedule(flush) : queueMicrotask(flush));
    return policy;
  }
  /** @type {ReturnType<typeof createPolicy> | undefined} */
  let surface = createPolicy();

  /** @param {unknown} source @param {unknown} error */
  function warn(source, error) {
    surface?.report(error, String(source));
  }

  /** @type {import("../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.failure-notices", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["notices"] },
    activate(ctx) {
      presenter = { show: mountFailurePresenter(ctx), schedule: ctx.frame };
      const active = surface ??= createPolicy();
      if (startupNotice) presenter.show(startupNotice);
      startupNotice = undefined;
      ctx.effect(() => () => { presenter = undefined; surface = undefined; startupNotice = undefined; });
      ctx.listen(window, "error", (event) => {
        const error = /** @type {ErrorEvent} */ (event);
        active.report(error.error ?? error.message, "Application error");
      });
      ctx.listen(window, "unhandledrejection", (event) => {
        active.report(/** @type {PromiseRejectionEvent} */ (event).reason, "Application error");
      });
    },
  };
  return { warn, module };
}
