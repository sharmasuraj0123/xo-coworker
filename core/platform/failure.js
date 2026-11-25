// @ts-check

/** @param {(message: string) => void} show */
export function createFailureSurface(show) {
  return {
    /** @param {unknown} error @param {string} source */
    report(error, source) {
      const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
      show(detail ? source + ": " + detail : source);
    },
  };
}
