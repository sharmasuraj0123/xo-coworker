// @ts-check

import { ApiError } from "../../platform/http.js";
import { reportFailure } from "../../platform/util.js";

export { reportFailure };

const REQUEST_INTERRUPTED = new Set(["network", "timeout", "signed_out"]);

/** @param {unknown} error @param {string} fallback */
export function requestFailureMessage(error, fallback) {
  if (!(error instanceof ApiError && REQUEST_INTERRUPTED.has(error.code))) reportFailure(error);
  return error instanceof Error ? error.message : fallback;
}
