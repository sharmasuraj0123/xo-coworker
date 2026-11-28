// @ts-check

import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import {RuntimeUsage, UsageDay, UsageModel, UsageTokens} from "./usage-types" */

/** @param {unknown} value */
const count = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
/** @param {unknown} value @param {(value: unknown) => boolean} check */
const optional = (value, check) => value === undefined || check(value);

/** @param {unknown} value @returns {value is UsageTokens} */
const isTokens = (value) => isResponseObject(value)
  && [value.input, value.output, value.cache_read, value.cache_write].every(count) && optional(value.reasoning, count);

/** @param {unknown} value @returns {value is UsageDay} */
const isDay = (value) => isResponseObject(value) && typeof value.date === "string" && count(value.tokens)
  && optional(value.cost, count) && optional(value.total_tokens, isTokens);

/** @param {unknown} value @returns {value is UsageModel} */
const isModel = (value) => isResponseObject(value) && typeof value.model_id === "string" && isTokens(value.total_tokens)
  && optional(value.total_cost, count) && optional(value.message_count, count);

/** @param {unknown} value @returns {value is RuntimeUsage} */
function isUsage(value) {
  if (!isResponseObject(value) || !count(value.total_cost) || !isTokens(value.total_tokens)) return false;
  if (!Array.isArray(value.daily) || !value.daily.every(isDay) || !Array.isArray(value.by_model)) return false;
  // a model row this view can't read costs only itself
  value.by_model = value.by_model.filter(isModel);
  return optional(value.estimated_tokens, (flag) => typeof flag === "boolean");
}

export const usageApi = {
  /** A runtime's usage over its last `days` days. @param {string} name @param {number} days @param {AbortSignal} [signal] */
  runtime: (name, days, signal) =>
    requestChecked(`/chat/runtimes/${encodeURIComponent(name)}/usage`, isUsage, { query: { days }, signal }),
};
