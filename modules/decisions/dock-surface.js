// @ts-check
import { findHtml, requireHtml } from "../../core/platform/dom.js";
import { dockGestures } from "../../shell/gestures.js";
import { createDock } from "./dock.js";
import { createDockFolds } from "./dock-folds.js";
import { createConversationDecisionActions } from "./conversation-actions.js";
import { askShort } from "./ask-label.js";

/** @param {import("./dock-surface-types").DockSurface} options */
export function mountDecisionDock(options) {
  const { CH, D, scope, world, convThread, convHost, schedule, region, view } = options;
  const el = requireHtml("#tdock"), folds = createDockFolds();
  const { decideKey, limitStatus } = createConversationDecisionActions({ ...options, unfold: folds.unfold, tdock: el });
  const deps = { CH, D, folds, world, convThread, convHost, askShort, schedule, dockGestures };
  const main = createDock({ scope, el, view, region }, deps);
  scope.effect(() => options.bus.on("app:decision-undone", main.undoReceipt));
  scope.listen(requireHtml("#top"), "click", ({ target }) => {
    const id = target instanceof Element && target.closest("[data-dock-open]")?.getAttribute("data-dock-open");
    if (!id) return;
    folds.unfold(id);
    main.render(D.needItems());
    scope.frame(() => findHtml(".card", undefined, el)?.focus({ preventScroll: true }));
  });
  return { main, createDock, deps, decideKey, limitStatus };
}
