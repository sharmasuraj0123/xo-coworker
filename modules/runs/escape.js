// @ts-check

/** @typedef {Pick<import("./read-types.d.ts").RunsReadDeps["RS"], "view" | "runId" | "gen" | "keepScroll">} RunsEscapeState */

/** @param {{ RS: RunsEscapeState, closeRuns: () => void, runsRender: () => void, repaint: () => void, runsLand: (selector: string) => HTMLElement | undefined, cancelDetail?: () => void }} deps */
export function createRunsEscape({ RS, closeRuns, runsRender, repaint, runsLand, cancelDetail }) {
  return function runsEscape() {
    if (RS.view !== "run") {
      closeRuns();
      return;
    }
    const id = RS.runId;
    RS.gen++;
    RS.view = "list";
    RS.runId = null;
    cancelDetail?.();
    RS.keepScroll = false;
    runsRender();
    repaint();
    runsLand(`[data-run="${CSS.escape(/** @type {string} */ (id))}"]`)?.focus({ preventScroll: true });
  };
}
