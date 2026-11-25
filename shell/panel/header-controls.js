// @ts-check

/** @typedef {Pick<import("../../core/kernel/types").ModuleContext, "listen">} Scope */

/** @typedef {{ toggle(): void, threads(): void }} Stage */

/** @typedef {{ isOpen: boolean, open(view: string, from: HTMLElement): unknown, close(): void }} LaunchWindow */

/** @param {Scope} scope @param {Stage} STAGE @param {LaunchWindow} LW @param {() => string} currentView */
export function bindPanelHeaderControls(scope, STAGE, LW, currentView) {
  scope.listen(document, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    if (target.closest("[data-stage-toggle]")) STAGE.toggle();
    else if (target.closest("[data-stage-open]")) STAGE.threads();
    else {
      const button = target.closest("[data-lp-open]");
      if (button instanceof HTMLElement) {
        if (LW.isOpen) LW.close();
        else LW.open(currentView(), button);
      }
    }
  });
}
