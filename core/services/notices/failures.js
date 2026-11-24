// @ts-check

/** @param {unknown} error */
export function reportFailure(error) {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
}
