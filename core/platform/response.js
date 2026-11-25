// @ts-check

import { ApiError, CHAT_STATUS_PATH, isResponseObject, requestJson } from "./http.js";

/** @template T @param {string} path @param {(v: unknown) => v is T} check @param {import("./http").RequestOptions} [options] */
async function requestChecked(path, check, options) {
  const value = await requestJson(path, options);
  options?.signal?.throwIfAborted();
  if (check(value)) return value;
  throw new ApiError(0, "bad_answer", `XO returned an unexpected answer for ${options?.method || "GET"} ${path}.`);
}

/** @param {unknown} value @returns {value is import("./status-types").StatusPool} */
function isPool(value) {
  if (!isResponseObject(value) || typeof value.id !== "string") return false;
  return [value.state, value.resets_at, value.reason].every((field) => field == null || typeof field === "string");
}

/** @param {unknown} value @returns {value is import("./status-types").EngineStatus} */
const isEngineStatus = (value) => isResponseObject(value)
  && (value.pools === undefined || (Array.isArray(value.pools) && value.pools.every(isPool)));

/** @param {{signal?: AbortSignal}} [options] */
export const engineStatus = (options) => requestChecked(CHAT_STATUS_PATH, isEngineStatus, options);
