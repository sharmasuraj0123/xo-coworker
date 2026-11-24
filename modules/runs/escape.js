// @ts-check

/** @typedef {Pick<import("./read-types.d.ts").RunsReadDeps["RS"], "view" | "runId" | "gen" | "pollT" | "keepScroll">} RunsEscapeState */

/** @param {{ RS: RunsEscapeState, closeRuns: () => void, runsRender: () => void, repaint: () => void, runsLand: (selector: string) => HTMLElement | undefined }} deps */
export function createRunsEscape({ RS, closeRuns, runsRender, repaint, runsLand }) {
  return function runsEscape() {
    if (RS.view !== "run") {
      closeRuns();
      return;
    }
    const id = RS.runId;
    RS.gen++;
    RS.view = "list";
    RS.runId = null;
    clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (RS.pollT));
    RS.keepScroll = false;
    runsRender();
    repaint();
    runsLand(`[data-run="${CSS.escape(/** @type {string} */ (id))}"]`)?.focus({ preventScroll: true });
  };
}
