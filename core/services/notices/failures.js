// @ts-check

import { interruptedRequest } from "../../platform/http.js";
import { reportFailure } from "../../platform/util.js";

export { reportFailure };

/** @param {unknown} error @param {string} fallback */
export function requestFailureMessage(error, fallback) {
  if (!interruptedRequest(error)) reportFailure(error);
  return error instanceof Error ? error.message : fallback;
}
